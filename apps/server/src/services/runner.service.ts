import { readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { EventEmitter } from "events";
import { db, runs, caseResults, eq, and, sql } from "@test-evals/db";
import type { Strategy, SSEEvent, FieldScores } from "@test-evals/shared";
import { extractTranscript, getStrategyPromptHash } from "./extract.service.js";
import { evaluateCase } from "./evaluate.service.js";

// ---- Path resolution ----

const DATA_DIR = resolve(
  new URL(import.meta.url).pathname,
  "../../../../../data",
);

async function loadTranscripts(filter?: string[]): Promise<{ id: string; text: string }[]> {
  const dir = join(DATA_DIR, "transcripts");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".txt")).sort();
  const filtered = filter ? files.filter((f) => filter.includes(f.replace(".txt", ""))) : files;
  return Promise.all(
    filtered.map(async (f) => ({
      id: f.replace(".txt", ""),
      text: await readFile(join(dir, f), "utf-8"),
    })),
  );
}

async function loadGold(id: string): Promise<unknown> {
  const path = join(DATA_DIR, "gold", `${id}.json`);
  return JSON.parse(await readFile(path, "utf-8"));
}

// ---- Semaphore for concurrency control ----

class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.permits--;
  }

  release(): void {
    this.permits++;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ---- Rate-limit backoff wrapper ----

async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("withRateLimitRetry: max retries exceeded");
}

// ---- SSE event bus ----

export const runEvents = new EventEmitter();
runEvents.setMaxListeners(100);

// ---- Runner ----

async function processCase(
  runId: number,
  transcript: { id: string; text: string },
  strategy: Strategy,
  sem: Semaphore,
  force = false,
): Promise<void> {
  await sem.acquire();
  try {
    // Idempotency: skip already-completed cases unless force=true
    const existing = await db
      .select()
      .from(caseResults)
      .where(and(eq(caseResults.runId, runId), eq(caseResults.transcriptId, transcript.id)))
      .limit(1);

    if (!force && existing[0]?.status === "completed") {
      runEvents.emit(`run:${runId}`, {
        type: "case_complete",
        transcriptId: transcript.id,
        scores: existing[0].scores as FieldScores | null,
      } satisfies SSEEvent);
      return;
    }

    // Create/reset the case record
    const [caseRow] = await db
      .insert(caseResults)
      .values({ runId, transcriptId: transcript.id, status: "pending" })
      .onConflictDoNothing()
      .returning();

    const caseId = caseRow?.id ?? existing[0]!.id;

    // Extract
    const extraction = await withRateLimitRetry(() =>
      extractTranscript(transcript.text, transcript.id, strategy),
    );

    // Score
    let scores: FieldScores | null = null;
    if (extraction.prediction) {
      const gold = await loadGold(transcript.id);
      scores = evaluateCase(extraction.prediction, gold as Parameters<typeof evaluateCase>[1]);
    }

    // Persist
    await db
      .update(caseResults)
      .set({
        status: "completed",
        prediction: extraction.prediction ?? null,
        scores: scores ?? null,
        isSchemaInvalid: extraction.isSchemaInvalid,
        hallucinationCount: extraction.hallucinationCount,
        inputTokens: extraction.inputTokens,
        outputTokens: extraction.outputTokens,
        cacheReadInputTokens: extraction.cacheReadInputTokens,
        cacheCreationInputTokens: extraction.cacheCreationInputTokens,
        costUsd: String(extraction.costUsd),
        attempts: extraction.attempts,
        wallTimeMs: extraction.wallTimeMs,
        completedAt: new Date(),
      })
      .where(eq(caseResults.id, caseId));

    // Real-time counter update so dashboards see progress immediately
    await db
      .update(runs)
      .set({ completedCases: sql`${runs.completedCases} + 1` })
      .where(eq(runs.id, runId));

    runEvents.emit(`run:${runId}`, {
      type: "case_complete",
      transcriptId: transcript.id,
      scores,
    } satisfies SSEEvent);
  } catch (err) {
    await db
      .update(caseResults)
      .set({ status: "failed", completedAt: new Date() })
      .where(and(eq(caseResults.runId, runId), eq(caseResults.transcriptId, transcript.id)));

    runEvents.emit(`run:${runId}`, {
      type: "case_failed",
      transcriptId: transcript.id,
      error: String(err),
    } satisfies SSEEvent);
  } finally {
    sem.release();
  }
}

export async function startRun(
  strategy: Strategy,
  model = "claude-haiku-4-5-20251001",
  datasetFilter?: string[],
  force = false,
): Promise<number> {
  const promptHash = getStrategyPromptHash(strategy);
  const transcripts = await loadTranscripts(datasetFilter);

  const [run] = await db
    .insert(runs)
    .values({
      strategy,
      model,
      promptHash,
      datasetFilter: datasetFilter ?? null,
      status: "running",
      totalCases: transcripts.length,
      completedCases: 0,
    })
    .returning();

  const runId = run!.id;
  executeRun(runId, transcripts, strategy, force).catch(console.error);
  return runId;
}

export async function resumeRun(runId: number): Promise<void> {
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!run) throw new Error(`Run ${runId} not found`);

  await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));

  const transcripts = await loadTranscripts(
    run.datasetFilter as string[] | undefined,
  );
  executeRun(runId, transcripts, run.strategy as Strategy).catch(console.error);
}

async function executeRun(
  runId: number,
  transcripts: { id: string; text: string }[],
  strategy: Strategy,
  force = false,
): Promise<void> {
  const sem = new Semaphore(5);
  const start = Date.now();

  await Promise.all(
    transcripts.map((t) => processCase(runId, t, strategy, sem, force)),
  );

  // Aggregate results
  const cases = await db
    .select()
    .from(caseResults)
    .where(eq(caseResults.runId, runId));

  const completed = cases.filter((c) => c.status === "completed");
  const failed = cases.filter((c) => c.status === "failed");
  const allScores = completed
    .map((c) => c.scores as FieldScores | null)
    .filter((s): s is FieldScores => s !== null);

  const aggregateF1 =
    allScores.length > 0
      ? allScores.reduce((sum, s) => sum + s.overall, 0) / allScores.length
      : null;

  const perField =
    allScores.length > 0
      ? {
          chief_complaint: allScores.reduce((s, x) => s + x.chief_complaint, 0) / allScores.length,
          vitals: allScores.reduce((s, x) => s + x.vitals.average, 0) / allScores.length,
          medications: allScores.reduce((s, x) => s + x.medications.f1, 0) / allScores.length,
          diagnoses: allScores.reduce((s, x) => s + x.diagnoses.f1, 0) / allScores.length,
          plan: allScores.reduce((s, x) => s + x.plan.f1, 0) / allScores.length,
          follow_up: allScores.reduce((s, x) => s + x.follow_up, 0) / allScores.length,
        }
      : null;

  const totals = cases.reduce(
    (acc, c) => ({
      inputTokens: acc.inputTokens + (c.inputTokens ?? 0),
      outputTokens: acc.outputTokens + (c.outputTokens ?? 0),
      cacheRead: acc.cacheRead + (c.cacheReadInputTokens ?? 0),
      cacheWrite: acc.cacheWrite + (c.cacheCreationInputTokens ?? 0),
      cost: acc.cost + parseFloat(String(c.costUsd ?? 0)),
      invalidSchema: acc.invalidSchema + (c.isSchemaInvalid ? 1 : 0),
      hallucinations: acc.hallucinations + (c.hallucinationCount ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheWrite: 0, cost: 0, invalidSchema: 0, hallucinations: 0 },
  );

  await db
    .update(runs)
    .set({
      status: "completed",
      completedCases: completed.length,
      failedCases: failed.length,
      invalidSchemaCount: totals.invalidSchema,
      hallucinationCount: totals.hallucinations,
      totalInputTokens: totals.inputTokens,
      totalOutputTokens: totals.outputTokens,
      totalCacheReadTokens: totals.cacheRead,
      totalCacheWriteTokens: totals.cacheWrite,
      totalCostUsd: String(totals.cost),
      wallTimeMs: Date.now() - start,
      aggregateF1: aggregateF1 !== null ? String(aggregateF1) : null,
      perFieldScores: perField ?? null,
      completedAt: new Date(),
    })
    .where(eq(runs.id, runId));

  runEvents.emit(`run:${runId}`, {
    type: "run_complete",
    completed: completed.length,
    total: transcripts.length,
  } satisfies SSEEvent);
}
