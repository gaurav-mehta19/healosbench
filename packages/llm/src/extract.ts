import Anthropic from "@anthropic-ai/sdk";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { Strategy, AttemptTrace, ExtractionResult, ClinicalExtraction } from "@test-evals/shared";
import { extractionTool } from "./tool.js";
import { getStrategy } from "./strategies/index.js";
import { hashPrompt } from "./hash.js";

const ajv = new Ajv({ strict: false });
addFormats(ajv);

// Clinical extraction JSON schema for AJV validation
const CLINICAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up"],
  properties: {
    chief_complaint: { type: "string", minLength: 1 },
    vitals: {
      type: "object",
      additionalProperties: false,
      required: ["bp", "hr", "temp_f", "spo2"],
      properties: {
        bp: { type: ["string", "null"], pattern: "^[0-9]{2,3}/[0-9]{2,3}$" },
        hr: { type: ["integer", "null"], minimum: 20, maximum: 250 },
        temp_f: { type: ["number", "null"], minimum: 90, maximum: 110 },
        spo2: { type: ["integer", "null"], minimum: 50, maximum: 100 },
      },
    },
    medications: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "dose", "frequency", "route"],
        properties: {
          name: { type: "string", minLength: 1 },
          dose: { type: ["string", "null"] },
          frequency: { type: ["string", "null"] },
          route: { type: ["string", "null"] },
        },
      },
    },
    diagnoses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["description"],
        properties: {
          description: { type: "string", minLength: 1 },
          icd10: { type: "string" },
        },
      },
    },
    plan: { type: "array", items: { type: "string", minLength: 1 } },
    follow_up: {
      type: "object",
      additionalProperties: false,
      required: ["interval_days", "reason"],
      properties: {
        interval_days: { type: ["integer", "null"], minimum: 0, maximum: 730 },
        reason: { type: ["string", "null"] },
      },
    },
  },
};

const validate = ajv.compile(CLINICAL_SCHEMA);

function validateExtraction(data: unknown): string[] {
  const valid = validate(data);
  if (valid) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath} ${e.message}`);
}

function computeCost(usage: {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}): number {
  // claude-haiku-4-5 pricing per million tokens
  const INPUT = 0.8;
  const OUTPUT = 4.0;
  const CACHE_READ = 0.08;
  const CACHE_WRITE = 1.0;
  return (
    (usage.inputTokens / 1_000_000) * INPUT +
    (usage.outputTokens / 1_000_000) * OUTPUT +
    (usage.cacheReadInputTokens / 1_000_000) * CACHE_READ +
    (usage.cacheCreationInputTokens / 1_000_000) * CACHE_WRITE
  );
}

function detectHallucinations(
  prediction: ClinicalExtraction,
  transcript: string,
): Record<string, boolean> {
  const normalized = transcript.toLowerCase().replace(/[^\w\s]/g, " ");

  function isGrounded(value: string | null | undefined): boolean {
    if (!value) return true;
    const v = value.toLowerCase().replace(/[^\w\s]/g, " ").trim();
    if (v.length < 3) return true;
    // check if any significant word from value appears in transcript
    const words = v.split(/\s+/).filter((w) => w.length > 3);
    if (words.length === 0) return true;
    return words.some((w) => normalized.includes(w));
  }

  const flags: Record<string, boolean> = {};
  flags["chief_complaint"] = !isGrounded(prediction.chief_complaint);
  for (const [i, med] of prediction.medications.entries()) {
    flags[`medications[${i}].name`] = !isGrounded(med.name);
  }
  for (const [i, dx] of prediction.diagnoses.entries()) {
    flags[`diagnoses[${i}].description`] = !isGrounded(dx.description);
  }
  return flags;
}

export function getPromptHash(strategy: Strategy): string {
  const { systemText } = getStrategy(strategy);
  return hashPrompt(systemText);
}

export async function extractClinical(
  client: Anthropic,
  transcript: string,
  transcriptId: string,
  strategy: Strategy,
  maxAttempts = 3,
): Promise<ExtractionResult> {
  const startTime = Date.now();
  const { systemBlocks, buildMessages } = getStrategy(strategy);
  const attempts: AttemptTrace[] = [];

  let messages = buildMessages(transcript);
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let prediction: ClinicalExtraction | null = null;
  let isSchemaInvalid = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemBlocks,
      tools: [extractionTool],
      tool_choice: { type: "auto" },
      messages,
    });

    const usage = response.usage as Anthropic.Usage & {
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };

    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;

    totalInput += usage.input_tokens;
    totalOutput += usage.output_tokens;
    totalCacheRead += cacheRead;
    totalCacheWrite += cacheWrite;

    // Find the tool use block
    const toolUse = response.content.find((b) => b.type === "tool_use") as
      | Anthropic.ToolUseBlock
      | undefined;

    if (!toolUse) {
      const traceEntry: AttemptTrace = {
        attempt,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadInputTokens: cacheRead,
        cacheCreationInputTokens: cacheWrite,
        validationErrors: ["Model did not call the extract_clinical_data tool"],
      };
      attempts.push(traceEntry);
      isSchemaInvalid = true;

      // Append to conversation for retry
      messages = [
        ...messages,
        { role: "assistant", content: response.content },
        {
          role: "user",
          content: "You must call the extract_clinical_data tool. Please try again.",
        },
      ];
      continue;
    }

    const errors = validateExtraction(toolUse.input);
    const traceEntry: AttemptTrace = {
      attempt,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadInputTokens: cacheRead,
      cacheCreationInputTokens: cacheWrite,
      output: toolUse.input,
      validationErrors: errors.length > 0 ? errors : undefined,
    };
    attempts.push(traceEntry);

    if (errors.length === 0) {
      prediction = toolUse.input as ClinicalExtraction;
      isSchemaInvalid = false;
      break;
    }

    // Retry with validation feedback
    isSchemaInvalid = true;
    messages = [
      ...messages,
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Validation failed. Errors:\n${errors.join("\n")}\n\nPlease correct the extraction and call the tool again.`,
            is_error: true,
          },
        ],
      },
    ];
  }

  const hallucinationFlags = prediction ? detectHallucinations(prediction, transcript) : {};
  const hallucinationCount = Object.values(hallucinationFlags).filter(Boolean).length;

  return {
    transcriptId,
    prediction,
    isSchemaInvalid,
    hallucinationFlags,
    hallucinationCount,
    attempts,
    inputTokens: totalInput,
    outputTokens: totalOutput,
    cacheReadInputTokens: totalCacheRead,
    cacheCreationInputTokens: totalCacheWrite,
    costUsd: computeCost({
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheReadInputTokens: totalCacheRead,
      cacheCreationInputTokens: totalCacheWrite,
    }),
    wallTimeMs: Date.now() - startTime,
  };
}
