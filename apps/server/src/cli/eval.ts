#!/usr/bin/env bun
import { config } from "dotenv";
import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { createClient, extractClinical, getPromptHash } from "@test-evals/llm";
import { evaluateCase, aggregateFieldScores } from "../services/evaluate.service.js";
import type { Strategy, FieldScores, ClinicalExtraction } from "@test-evals/shared";

// Load .env from apps/server/ regardless of where the CLI is invoked from
const SERVER_DIR = resolve(new URL(import.meta.url).pathname, "../../..");
config({ path: join(SERVER_DIR, ".env") });

const DATA_DIR = resolve(SERVER_DIR, "../../data");

function parseArgs(): { strategy: Strategy; model: string } {
  const args = process.argv.slice(2);
  let strategy: Strategy = "zero_shot";
  let model = "claude-haiku-4-5-20251001";

  for (const arg of args) {
    if (arg.startsWith("--strategy=")) {
      const val = arg.split("=")[1] as Strategy;
      const valid: Strategy[] = ["zero_shot", "few_shot", "cot"];
      if (!valid.includes(val)) {
        console.error(`Invalid strategy: ${val}. Choose from: ${valid.join(", ")}`);
        process.exit(1);
      }
      strategy = val;
    } else if (arg.startsWith("--model=")) {
      model = arg.split("=")[1]!;
    }
  }
  return { strategy, model };
}

function pad(s: string | number, len: number): string {
  return String(s).padEnd(len).slice(0, len);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

async function main() {
  const { strategy, model } = parseArgs();

  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set in environment");
    process.exit(1);
  }

  const client = createClient(apiKey);
  const promptHash = getPromptHash(strategy);

  const transcriptDir = join(DATA_DIR, "transcripts");
  const goldDir = join(DATA_DIR, "gold");
  const files = (await readdir(transcriptDir)).filter((f) => f.endsWith(".txt")).sort();

  console.log(`\nHEALOSBENCH — CLI Eval`);
  console.log(`Strategy: ${strategy}  Model: ${model}  Prompt hash: ${promptHash}`);
  console.log(`Cases: ${files.length}\n`);

  const CONCURRENCY = 5;
  const sem = { permits: CONCURRENCY, queue: [] as Array<() => void> };

  async function acquire() {
    if (sem.permits > 0) { sem.permits--; return; }
    await new Promise<void>((r) => sem.queue.push(r));
    sem.permits--;
  }
  function release() {
    sem.permits++;
    sem.queue.shift()?.();
  }

  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < 4; i++) {
      try { return await fn(); }
      catch (e: unknown) {
        const status = (e as { status?: number }).status;
        if (status === 429 && i < 3) {
          await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        throw e;
      }
    }
    throw new Error("unreachable");
  }

  const allScores: FieldScores[] = [];
  let totalCost = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let invalidSchema = 0;
  let hallucinations = 0;
  let completed = 0;

  const rows: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      await acquire();
      try {
        const id = file.replace(".txt", "");
        const text = await readFile(join(transcriptDir, file), "utf-8");
        const gold = JSON.parse(await readFile(join(goldDir, `${id}.json`), "utf-8")) as ClinicalExtraction;

        const result = await withRetry(() => extractClinical(client, text, id, strategy));

        let scores: FieldScores | null = null;
        if (result.prediction) {
          scores = evaluateCase(result.prediction, gold);
          allScores.push(scores);
        } else {
          invalidSchema++;
        }

        totalCost += result.costUsd;
        totalCacheRead += result.cacheReadInputTokens;
        totalCacheWrite += result.cacheCreationInputTokens;
        hallucinations += result.hallucinationCount;
        completed++;

        const overall = scores ? pct(scores.overall) : "FAIL";
        rows.push(
          `${pad(id, 12)} ${pad(overall, 8)} ${pad(scores ? pct(scores.chief_complaint) : "-", 8)} ${pad(scores ? pct(scores.medications.f1) : "-", 8)} ${pad(scores ? pct(scores.diagnoses.f1) : "-", 8)} ${pad(result.attempts.length, 4)} $${result.costUsd.toFixed(5)}`,
        );
        process.stdout.write(`\r  Completed ${completed}/${files.length}...`);
      } finally {
        release();
      }
    }),
  );

  console.log("\n");

  // Print case table
  console.log(
    `${pad("Case", 12)} ${pad("Overall", 8)} ${pad("CC", 8)} ${pad("Meds", 8)} ${pad("Dx", 8)} ${pad("Try", 4)} Cost`,
  );
  console.log("-".repeat(70));
  rows.sort().forEach((r) => console.log(r));

  // Print aggregate
  const agg = aggregateFieldScores(allScores);
  console.log("\n" + "=".repeat(70));
  console.log("AGGREGATE SCORES");
  console.log("=".repeat(70));
  console.log(`Overall F1:        ${pct(agg.overall)}`);
  console.log(`Chief complaint:   ${pct(agg.chief_complaint)}`);
  console.log(`Vitals:            ${pct(agg.vitals)}`);
  console.log(`Medications F1:    ${pct(agg.medications)}`);
  console.log(`Diagnoses F1:      ${pct(agg.diagnoses)}`);
  console.log(`Plan F1:           ${pct(agg.plan)}`);
  console.log(`Follow-up:         ${pct(agg.follow_up)}`);
  console.log(`\nSchema invalid:    ${invalidSchema}`);
  console.log(`Hallucinations:    ${hallucinations}`);
  console.log(`Cache reads:       ${totalCacheRead.toLocaleString()} tokens`);
  console.log(`Cache writes:      ${totalCacheWrite.toLocaleString()} tokens`);
  console.log(`Total cost:        $${totalCost.toFixed(4)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
