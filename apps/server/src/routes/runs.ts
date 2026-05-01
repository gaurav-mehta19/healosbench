import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { db, runs, caseResults, eq, desc } from "@test-evals/db";
import type { Strategy, StartRunRequest } from "@test-evals/shared";
import { startRun, resumeRun, runEvents } from "../services/runner.service.js";

const runsRouter = new Hono();

// List all runs
runsRouter.get("/", async (c) => {
  const allRuns = await db.select().from(runs).orderBy(desc(runs.createdAt));
  return c.json(allRuns);
});

// Start a new run
runsRouter.post("/", async (c) => {
  const body = (await c.req.json()) as StartRunRequest;
  const { strategy, model, datasetFilter, force } = body;

  const validStrategies: Strategy[] = ["zero_shot", "few_shot", "cot"];
  if (!validStrategies.includes(strategy)) {
    return c.json({ error: `Invalid strategy. Must be one of: ${validStrategies.join(", ")}` }, 400);
  }

  const runId = await startRun(strategy, model, datasetFilter, force);
  return c.json({ runId }, 201);
});

// !! /compare MUST come before /:id to prevent the wildcard from swallowing it
runsRouter.get("/compare", async (c) => {
  const run1Id = parseInt(c.req.query("run1") ?? "");
  const run2Id = parseInt(c.req.query("run2") ?? "");
  if (isNaN(run1Id) || isNaN(run2Id)) {
    return c.json({ error: "Provide ?run1=<id>&run2=<id>" }, 400);
  }

  const [runA, runB] = await Promise.all([
    db.select().from(runs).where(eq(runs.id, run1Id)).limit(1),
    db.select().from(runs).where(eq(runs.id, run2Id)).limit(1),
  ]);

  if (!runA[0] || !runB[0]) return c.json({ error: "One or both runs not found" }, 404);

  const perA = (runA[0].perFieldScores ?? {}) as Record<string, number>;
  const perB = (runB[0].perFieldScores ?? {}) as Record<string, number>;

  const fields = ["chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up", "overall"];
  const fieldDeltas: Record<string, { scoreA: number; scoreB: number; delta: number; winner: string }> = {};

  for (const field of fields) {
    const scoreA = field === "overall"
      ? parseFloat(String(runA[0].aggregateF1 ?? 0))
      : (perA[field] ?? 0);
    const scoreB = field === "overall"
      ? parseFloat(String(runB[0].aggregateF1 ?? 0))
      : (perB[field] ?? 0);
    const delta = scoreB - scoreA;
    fieldDeltas[field] = {
      scoreA,
      scoreB,
      delta,
      winner: Math.abs(delta) < 0.001 ? "tie" : delta > 0 ? "B" : "A",
    };
  }

  const overallDelta = fieldDeltas["overall"]!;
  return c.json({
    runA: runA[0],
    runB: runB[0],
    fieldDeltas,
    overallWinner: overallDelta.winner,
  });
});

// Get run detail with all cases
runsRouter.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid run id" }, 400);

  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) return c.json({ error: "Run not found" }, 404);

  const cases = await db
    .select()
    .from(caseResults)
    .where(eq(caseResults.runId, id))
    .orderBy(caseResults.transcriptId);

  return c.json({ ...run, cases });
});

// Get a single case (full prediction JSON included)
runsRouter.get("/:id/cases/:caseId", async (c) => {
  const runId = parseInt(c.req.param("id"));
  const caseId = parseInt(c.req.param("caseId"));
  if (isNaN(runId) || isNaN(caseId)) return c.json({ error: "Invalid id" }, 400);

  const [caseRow] = await db
    .select()
    .from(caseResults)
    .where(eq(caseResults.id, caseId))
    .limit(1);

  if (!caseRow || caseRow.runId !== runId) return c.json({ error: "Case not found" }, 404);
  return c.json(caseRow);
});

// Resume a paused/failed run
runsRouter.post("/:id/resume", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid run id" }, 400);

  try {
    await resumeRun(id);
    return c.json({ resumed: true, runId: id });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});

// SSE stream for run progress
runsRouter.get("/:id/stream", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "Invalid run id" }, 400);

  return streamSSE(c, async (stream) => {
    const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
    if (!run) {
      await stream.writeSSE({ data: JSON.stringify({ error: "Run not found" }), event: "error" });
      return;
    }

    if (run.status === "completed" || run.status === "failed") {
      await stream.writeSSE({ data: JSON.stringify({ type: "run_complete" }), event: "message" });
      return;
    }

    await new Promise<void>((resolve) => {
      const handler = async (event: unknown) => {
        const evt = event as { type: string };
        await stream.writeSSE({ data: JSON.stringify(event), event: "message" });
        if (evt.type === "run_complete" || evt.type === "run_failed") {
          runEvents.off(`run:${id}`, handler);
          resolve();
        }
      };
      runEvents.on(`run:${id}`, handler);

      stream.onAbort(() => {
        runEvents.off(`run:${id}`, handler);
        resolve();
      });
    });
  });
});

export { runsRouter };
