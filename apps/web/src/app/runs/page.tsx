"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getRuns, startRun } from "@/lib/api";

type Run = {
  id: number;
  strategy: string;
  model: string;
  status: string;
  totalCases: number;
  completedCases: number;
  aggregateF1: string | null;
  totalCostUsd: string;
  wallTimeMs: number;
  createdAt: string;
  promptHash: string;
};

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    running: "bg-blue-100 text-blue-800",
    failed: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-700",
    paused: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
}

function pct(n: string | null | number): string {
  if (n === null || n === undefined) return "—";
  return (parseFloat(String(n)) * 100).toFixed(1) + "%";
}

function ms(n: number): string {
  if (n < 1000) return `${n}ms`;
  if (n < 60_000) return `${(n / 1000).toFixed(1)}s`;
  return `${(n / 60_000).toFixed(1)}m`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [strategy, setStrategy] = useState<"zero_shot" | "few_shot" | "cot">("zero_shot");
  const [error, setError] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getRuns();
      setRuns(data as Run[]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [fetchRuns]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const { runId } = await startRun({ strategy });
      await fetchRuns();
      window.location.href = `/runs/${runId}`;
    } catch (e) {
      setError(String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">HEALOSBENCH Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">LLM evaluation harness for clinical extraction</p>
        </div>
        <div className="flex gap-3 items-center">
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as typeof strategy)}
            className="border rounded px-3 py-2 text-sm bg-background text-foreground"
          >
            <option value="zero_shot">Zero Shot</option>
            <option value="few_shot">Few Shot</option>
            <option value="cot">Chain of Thought</option>
          </select>
          <button
            onClick={handleStart}
            disabled={starting}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start Run"}
          </button>
          <Link
            href="/compare"
            className="border px-4 py-2 rounded text-sm font-medium hover:bg-muted"
          >
            Compare
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 py-12 text-center">Loading runs…</div>
      ) : runs.length === 0 ? (
        <div className="text-gray-400 py-12 text-center border rounded-lg">
          No runs yet. Start one above.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Strategy</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Progress</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">F1</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Hash</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={`/runs/${run.id}`} className="text-blue-600 hover:underline font-medium">
                      #{run.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{run.strategy}</td>
                  <td className="px-4 py-3">{statusBadge(run.status)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {run.completedCases}/{run.totalCases}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {run.aggregateF1 !== null ? (
                      <span className="text-green-700">{pct(run.aggregateF1)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">${parseFloat(run.totalCostUsd).toFixed(4)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{ms(run.wallTimeMs)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{run.promptHash.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(run.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
