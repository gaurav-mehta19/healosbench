"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getRuns, getCompare } from "@/lib/api";

type Run = { id: number; strategy: string; model: string; status: string; aggregateF1: string | null };

type FieldDelta = {
  scoreA: number;
  scoreB: number;
  delta: number;
  winner: "A" | "B" | "tie";
};

type CompareResult = {
  runA: Run & { strategy: string; promptHash: string; totalCostUsd: string };
  runB: Run & { strategy: string; promptHash: string; totalCostUsd: string };
  fieldDeltas: Record<string, FieldDelta>;
  overallWinner: "A" | "B" | "tie";
};

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function deltaColor(delta: number): string {
  if (Math.abs(delta) < 0.001) return "text-gray-500";
  return delta > 0 ? "text-green-600" : "text-red-600";
}

function winnerBadge(winner: string, side: "A" | "B") {
  if (winner === "tie") return null;
  if (winner === side) {
    return <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">WIN</span>;
  }
  return null;
}

const FIELD_ORDER = ["overall", "chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up"];
const FIELD_LABELS: Record<string, string> = {
  overall: "Overall F1",
  chief_complaint: "Chief Complaint",
  vitals: "Vitals",
  medications: "Medications F1",
  diagnoses: "Diagnoses F1",
  plan: "Plan F1",
  follow_up: "Follow-up",
};

function CompareContent() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<Run[]>([]);
  const [runA, setRunA] = useState<string>(searchParams.get("run1") ?? "");
  const [runB, setRunB] = useState<string>(searchParams.get("run2") ?? "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRuns()
      .then((data) => setRuns(data as Run[]))
      .catch((e) => setError(String(e)));
  }, []);

  const compare = useCallback(async () => {
    if (!runA || !runB) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getCompare(parseInt(runA), parseInt(runB));
      setResult(data as CompareResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [runA, runB]);

  useEffect(() => {
    if (runA && runB) compare();
  }, [runA, runB, compare]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/runs" className="text-blue-600 hover:underline text-sm">← Runs</Link>
        <h1 className="text-xl font-bold">Compare Runs</h1>
      </div>

      {/* Run selectors */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Run A</label>
          <select
            value={runA}
            onChange={(e) => setRunA(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
          >
            <option value="">Select run A…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} — {r.strategy} {r.aggregateF1 ? `(F1: ${(parseFloat(r.aggregateF1) * 100).toFixed(1)}%)` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">Run B</label>
          <select
            value={runB}
            onChange={(e) => setRunB(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-background text-foreground"
          >
            <option value="">Select run B…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id} — {r.strategy} {r.aggregateF1 ? `(F1: ${(parseFloat(r.aggregateF1) * 100).toFixed(1)}%)` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={compare}
            disabled={!runA || !runB || loading}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Comparing…" : "Compare"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 text-sm">{error}</div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Run headers */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-sm font-medium text-muted-foreground"></div>
            {[
              { label: "Run A", run: result.runA },
              { label: "Run B", run: result.runB },
            ].map(({ label, run }) => (
              <div key={label} className="border rounded-lg p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1">{label}</div>
                <Link href={`/runs/${run.id}`} className="text-blue-600 hover:underline font-medium">
                  #{run.id}
                </Link>
                <div className="text-sm mt-1">{run.strategy}</div>
                <div className="text-xs text-muted-foreground font-mono mt-1">{run.promptHash?.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground mt-1">${parseFloat(run.totalCostUsd ?? "0").toFixed(4)}</div>
              </div>
            ))}
          </div>

          {/* Overall winner banner */}
          <div className={`rounded-lg p-4 text-center font-semibold ${result.overallWinner === "tie" ? "bg-muted text-muted-foreground" : "bg-green-50 dark:bg-green-950 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"}`}>
            {result.overallWinner === "tie"
              ? "Tie — both runs perform equally overall"
              : `Run ${result.overallWinner} wins overall (strategy: ${result.overallWinner === "A" ? result.runA.strategy : result.runB.strategy})`}
          </div>

          {/* Per-field comparison table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted border-b px-4 py-3 text-sm font-semibold">Per-field breakdown</div>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-40">Field</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Run A score</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Run B score</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Δ (B − A)</th>
                  <th className="px-4 py-2 text-center font-medium text-muted-foreground">Winner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {FIELD_ORDER.filter((f) => result.fieldDeltas[f]).map((field) => {
                  const d = result.fieldDeltas[field]!;
                  return (
                    <tr key={field} className={field === "overall" ? "bg-blue-50 dark:bg-blue-950 font-semibold" : "hover:bg-muted/50"}>
                      <td className="px-4 py-3">{FIELD_LABELS[field] ?? field}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={d.winner === "A" ? "font-bold text-green-700" : ""}>
                          {pct(d.scoreA)}
                        </span>
                        {winnerBadge(d.winner, "A")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={d.winner === "B" ? "font-bold text-green-700" : ""}>
                          {pct(d.scoreB)}
                        </span>
                        {winnerBadge(d.winner, "B")}
                      </td>
                      <td className={`px-4 py-3 text-center font-medium ${deltaColor(d.delta)}`}>
                        {d.delta >= 0 ? "+" : ""}{pct(d.delta)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.winner === "tie" ? (
                          <span className="text-gray-400 text-xs">tie</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.winner === "B" ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300" : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"}`}>
                            Run {d.winner}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signal summary */}
          <div className="border rounded-lg p-4 text-sm">
            <div className="font-semibold mb-2">Signal summary</div>
            <div className="space-y-1 text-muted-foreground">
              {FIELD_ORDER.filter((f) => f !== "overall" && result.fieldDeltas[f]).map((field) => {
                const d = result.fieldDeltas[field]!;
                if (d.winner === "tie") return null;
                return (
                  <div key={field}>
                    <span className={d.winner === "B" ? "text-green-700 font-medium" : "text-blue-700 font-medium"}>
                      Run {d.winner}
                    </span>
                    {" "}wins on <span className="font-medium">{FIELD_LABELS[field]}</span>
                    {" "}by {pct(Math.abs(d.delta))}
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Loading…</div>}>
      <CompareContent />
    </Suspense>
  );
}
