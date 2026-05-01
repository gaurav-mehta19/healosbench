import { extractClinical, getPromptHash, createClient } from "@test-evals/llm";
import type { Strategy, ExtractionResult } from "@test-evals/shared";

type LlmClient = ReturnType<typeof createClient>;

let _client: LlmClient | null = null;

function getClient(): LlmClient {
  if (!_client) {
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
    _client = createClient(apiKey);
  }
  return _client;
}

export function getStrategyPromptHash(strategy: Strategy): string {
  return getPromptHash(strategy);
}

export async function extractTranscript(
  transcript: string,
  transcriptId: string,
  strategy: Strategy,
): Promise<ExtractionResult> {
  const client = getClient();
  return extractClinical(client, transcript, transcriptId, strategy);
}
