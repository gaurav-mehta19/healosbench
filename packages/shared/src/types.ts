export type Strategy = "zero_shot" | "few_shot" | "cot";

export interface Vitals {
  bp: string | null;
  hr: number | null;
  temp_f: number | null;
  spo2: number | null;
}

export interface Medication {
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
}

export interface Diagnosis {
  description: string;
  icd10?: string;
}

export interface FollowUp {
  interval_days: number | null;
  reason: string | null;
}

export interface ClinicalExtraction {
  chief_complaint: string;
  vitals: Vitals;
  medications: Medication[];
  diagnoses: Diagnosis[];
  plan: string[];
  follow_up: FollowUp;
}

export interface VitalsScore {
  bp: number;
  hr: number;
  temp_f: number;
  spo2: number;
  average: number;
}

export interface MedScore {
  precision: number;
  recall: number;
  f1: number;
}

export interface FieldScores {
  chief_complaint: number;
  vitals: VitalsScore;
  medications: MedScore;
  diagnoses: MedScore;
  plan: MedScore;
  follow_up: number;
  overall: number;
}

export interface AttemptTrace {
  attempt: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  validationErrors?: string[];
  output?: unknown;
}

export interface ExtractionResult {
  transcriptId: string;
  prediction: ClinicalExtraction | null;
  isSchemaInvalid: boolean;
  hallucinationFlags: Record<string, boolean>;
  hallucinationCount: number;
  attempts: AttemptTrace[];
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUsd: number;
  wallTimeMs: number;
}

export interface CaseResult {
  id: number;
  runId: number;
  transcriptId: string;
  status: "pending" | "completed" | "failed";
  prediction: ClinicalExtraction | null;
  scores: FieldScores | null;
  isSchemaInvalid: boolean;
  hallucinationCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUsd: number;
  attempts: AttemptTrace[];
  wallTimeMs: number;
  createdAt: string;
  completedAt: string | null;
}

export interface RunSummary {
  id: number;
  strategy: Strategy;
  model: string;
  promptHash: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  totalCases: number;
  completedCases: number;
  failedCases: number;
  invalidSchemaCount: number;
  hallucinationCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalCostUsd: number;
  wallTimeMs: number;
  aggregateF1: number | null;
  perFieldScores: Partial<Record<keyof Omit<FieldScores, "overall">, number>> | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RunDetail extends RunSummary {
  cases: CaseResult[];
}

export interface CompareResult {
  runA: RunSummary;
  runB: RunSummary;
  fieldDeltas: Record<string, { scoreA: number; scoreB: number; delta: number; winner: "A" | "B" | "tie" }>;
  overallWinner: "A" | "B" | "tie";
}

export interface StartRunRequest {
  strategy: Strategy;
  model?: string;
  datasetFilter?: string[];
  force?: boolean;
}

export interface SSEEvent {
  type: "case_complete" | "case_failed" | "run_complete" | "run_failed" | "progress";
  transcriptId?: string;
  completed?: number;
  total?: number;
  scores?: FieldScores | null;
  error?: string;
}
