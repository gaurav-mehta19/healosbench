const SERVER_URL =
  typeof window !== "undefined"
    ? (process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:8787")
    : (process.env["NEXT_PUBLIC_SERVER_URL"] ?? "http://localhost:8787");

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

export function getRuns() {
  return apiFetch<unknown[]>("/api/v1/runs");
}

export function getRun(id: number) {
  return apiFetch<unknown>(`/api/v1/runs/${id}`);
}

export function getCompare(run1: number, run2: number) {
  return apiFetch<unknown>(`/api/v1/runs/compare?run1=${run1}&run2=${run2}`);
}

export function startRun(body: { strategy: string; model?: string; force?: boolean }) {
  return apiFetch<{ runId: number }>("/api/v1/runs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resumeRun(id: number) {
  return apiFetch<{ resumed: boolean }>(`/api/v1/runs/${id}/resume`, { method: "POST" });
}

export const SERVER_BASE = SERVER_URL;
