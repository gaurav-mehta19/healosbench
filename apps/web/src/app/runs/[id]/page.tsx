"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { getRun, resumeRun } from "@/lib/api";
import { SERVER_BASE } from "@/lib/api";

type CaseResult = {
  id: number;
  transcriptId: string;
  status: string;
  prediction: Record<string, unknown> | null;
  scores: {
    chief_complaint: number;
    vitals: { bp: number; hr: number; temp_f: number; spo2: number; average: number };
    medications: { precision: number; recall: number; f1: number };
    diagnoses: { precision: number; recall: number; f1: number };
    plan: { precision: number; recall: number; f1: number };
    follow_up: number;
    overall: number;
  } | null;
  isSchemaInvalid: boolean;
  hallucinationCount: number;
  costUsd: string;
  attempts: Array<{
    attempt: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    validationErrors?: string[];
    output?: unknown;
  }>;
};

type RunDetail = {
  id: number;
  strategy: string;
  model: string;
  status: string;
  totalCases: number;
  completedCases: number;
  aggregateF1: string | null;
  totalCostUsd: string;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  wallTimeMs: number;
  perFieldScores: Record<string, number> | null;
  promptHash: string;
  cases: CaseResult[];
};

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return (n * 100).toFixed(1) + "%";
}

function scoreColor(n: number): string {
  if (n >= 0.8) return "text-green-700";
  if (n >= 0.5) return "text-yellow-700";
  return "text-red-600";
}

export default function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<CaseResult | null>(null);
  const [transcriptText, setTranscriptText] = useState<string>("");
  const [goldData, setGoldData] = useState<Record<string, unknown> | null>(null);
  const [liveEvents, setLiveEvents] = useState<string[]>([]);

  useEffect(() => {
    let es: EventSource | null = null;

    async function load() {
      try {
        const data = (await getRun(parseInt(id))) as RunDetail;
        setRun(data);

        // Stream live progress if still running
        if (data.status === "running") {
          es = new EventSource(`${SERVER_BASE}/api/v1/runs/${id}/stream`);
          es.onmessage = (e) => {
            const evt = JSON.parse(e.data) as { type: string; transcriptId?: string };
            setLiveEvents((prev) => [...prev.slice(-19), `${evt.type}: ${evt.transcriptId ?? ""}`]);
            if (evt.type === "run_complete") {
              es?.close();
              getRun(parseInt(id)).then((d) => setRun(d as RunDetail));
            }
          };
        }
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => es?.close();
  }, [id]);

  async function openCase(c: CaseResult) {
    setSelectedCase(c);
    // Fetch transcript and gold via server API
    try {
      const [transcript, gold] = await Promise.all([
        fetch(`${SERVER_BASE}/api/v1/data/transcripts/${c.transcriptId}`).then((r) => r.text()),
        fetch(`${SERVER_BASE}/api/v1/data/gold/${c.transcriptId}`).then((r) => r.json() as Promise<Record<string, unknown>>),
      ]);
      setTranscriptText(transcript);
      setGoldData(gold);
    } catch {
      setTranscriptText("(transcript not available via API — check data/ directory)");
      setGoldData(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-400">Loading run…</div>;
  }
  if (!run) {
    return <div className="p-6 text-red-600">Run not found.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/runs" className="text-blue-600 hover:underline text-sm">← Runs</Link>
        <h1 className="text-xl font-bold">Run #{run.id} — {run.strategy}</h1>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${run.status === "completed" ? "bg-green-100 text-green-800" : run.status === "running" ? "bg-blue-100 text-blue-800" : "bg-gray-100"}`}>
          {run.status}
        </span>
        {run.status !== "running" && run.status !== "completed" && (
          <button
            onClick={() => resumeRun(run.id)}
            className="text-xs border px-3 py-1 rounded hover:bg-gray-50"
          >
            Resume
          </button>
        )}
        <Link
          href={`/compare?run1=${run.id}`}
          className="ml-auto text-xs border px-3 py-1 rounded hover:bg-gray-50"
        >
          Compare this run
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Overall F1", value: pct(parseFloat(run.aggregateF1 ?? "0")) },
          { label: "Cases", value: `${run.completedCases}/${run.totalCases}` },
          { label: "Cost", value: `$${parseFloat(run.totalCostUsd).toFixed(4)}` },
          { label: "Cache reads", value: run.totalCacheReadTokens.toLocaleString() + " tok" },
        ].map(({ label, value }) => (
          <div key={label} className="border rounded-lg p-4">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {/* Per-field scores */}
      {run.perFieldScores && (
        <div className="mb-6 border rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 mb-3">Per-field scores</div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {Object.entries(run.perFieldScores).map(([field, score]) => (
              <div key={field} className="text-center">
                <div className={`text-lg font-bold ${scoreColor(score)}`}>{pct(score)}</div>
                <div className="text-xs text-gray-500">{field.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live events */}
      {liveEvents.length > 0 && (
        <div className="mb-4 bg-gray-50 border rounded p-3 font-mono text-xs text-gray-600 max-h-32 overflow-y-auto">
          {liveEvents.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Cases table + Case detail split */}
      <div className="flex gap-4">
        {/* Cases list */}
        <div className="flex-1 border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Case</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Overall</th>
                <th className="px-3 py-2 text-left font-medium">CC</th>
                <th className="px-3 py-2 text-left font-medium">Meds</th>
                <th className="px-3 py-2 text-left font-medium">Dx</th>
                <th className="px-3 py-2 text-left font-medium">Tries</th>
                <th className="px-3 py-2 text-left font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {run.cases.map((c) => (
                <tr
                  key={c.id}
                  className={`cursor-pointer hover:bg-blue-50 ${selectedCase?.id === c.id ? "bg-blue-50" : ""}`}
                  onClick={() => openCase(c)}
                >
                  <td className="px-3 py-2 font-mono">{c.transcriptId}</td>
                  <td className="px-3 py-2">
                    {c.isSchemaInvalid ? (
                      <span className="text-red-500">INVALID</span>
                    ) : (
                      <span className={c.status === "completed" ? "text-green-600" : "text-gray-400"}>
                        {c.status}
                      </span>
                    )}
                  </td>
                  <td className={`px-3 py-2 font-medium ${c.scores ? scoreColor(c.scores.overall) : ""}`}>
                    {c.scores ? pct(c.scores.overall) : "—"}
                  </td>
                  <td className="px-3 py-2">{c.scores ? pct(c.scores.chief_complaint) : "—"}</td>
                  <td className="px-3 py-2">{c.scores ? pct(c.scores.medications.f1) : "—"}</td>
                  <td className="px-3 py-2">{c.scores ? pct(c.scores.diagnoses.f1) : "—"}</td>
                  <td className="px-3 py-2 text-gray-500">{c.attempts.length}</td>
                  <td className="px-3 py-2">
                    {c.hallucinationCount > 0 && (
                      <span className="text-orange-500" title="Hallucinations detected">⚠ {c.hallucinationCount}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Case detail panel */}
        {selectedCase && (
          <div className="w-96 border rounded-lg overflow-hidden flex flex-col">
            <div className="bg-gray-50 border-b px-4 py-3 text-sm font-medium flex justify-between">
              <span>{selectedCase.transcriptId}</span>
              <button onClick={() => setSelectedCase(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="overflow-y-auto p-4 text-xs space-y-4 flex-1">
              {/* Scores */}
              {selectedCase.scores && (
                <div>
                  <div className="font-semibold mb-2">Scores</div>
                  <div className="space-y-1">
                    {(
                      [
                        ["Chief complaint", selectedCase.scores.chief_complaint],
                        ["Vitals avg", selectedCase.scores.vitals.average],
                        ["Medications F1", selectedCase.scores.medications.f1],
                        ["Diagnoses F1", selectedCase.scores.diagnoses.f1],
                        ["Plan F1", selectedCase.scores.plan.f1],
                        ["Follow-up", selectedCase.scores.follow_up],
                        ["Overall", selectedCase.scores.overall],
                      ] as Array<[string, number]>
                    ).map(([label, score]) => (
                      <div key={label} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className={`font-medium ${scoreColor(score)}`}>
                          {pct(score)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transcript */}
              {transcriptText && (
                <div>
                  <div className="font-semibold mb-1">Transcript</div>
                  <pre className="text-gray-600 whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border max-h-48 overflow-y-auto">
                    {transcriptText}
                  </pre>
                </div>
              )}

              {/* Gold vs Predicted */}
              {goldData && (
                <div>
                  <div className="font-semibold mb-1">Gold</div>
                  <pre className="text-gray-600 whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border max-h-48 overflow-y-auto">
                    {JSON.stringify(goldData, null, 2)}
                  </pre>
                </div>
              )}
              {selectedCase.prediction && (
                <div>
                  <div className="font-semibold mb-1">Predicted</div>
                  <pre className="text-gray-600 whitespace-pre-wrap text-xs bg-gray-50 p-2 rounded border max-h-48 overflow-y-auto">
                    {JSON.stringify(selectedCase.prediction, null, 2)}
                  </pre>
                </div>
              )}

              {/* LLM Trace */}
              <div>
                <div className="font-semibold mb-2">LLM Trace ({selectedCase.attempts.length} attempt{selectedCase.attempts.length !== 1 ? "s" : ""})</div>
                {selectedCase.attempts.map((a) => (
                  <div key={a.attempt} className="border rounded p-2 mb-2 bg-gray-50">
                    <div className="font-medium mb-1">Attempt {a.attempt}</div>
                    <div className="text-gray-500 space-y-0.5">
                      <div>In: {a.inputTokens} | Out: {a.outputTokens} | Cache↑: {a.cacheCreationInputTokens} | Cache↓: {a.cacheReadInputTokens}</div>
                      {a.validationErrors && (
                        <div className="text-red-500">
                          Errors: {a.validationErrors.join("; ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
