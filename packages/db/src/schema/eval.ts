import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const runs = pgTable("runs", {
  id: serial("id").primaryKey(),
  strategy: text("strategy").notNull(),
  model: text("model").notNull(),
  promptHash: text("prompt_hash").notNull(),
  datasetFilter: jsonb("dataset_filter"),
  status: text("status").notNull().default("pending"),
  totalCases: integer("total_cases").notNull().default(0),
  completedCases: integer("completed_cases").notNull().default(0),
  failedCases: integer("failed_cases").notNull().default(0),
  invalidSchemaCount: integer("invalid_schema_count").notNull().default(0),
  hallucinationCount: integer("hallucination_count").notNull().default(0),
  totalInputTokens: integer("total_input_tokens").notNull().default(0),
  totalOutputTokens: integer("total_output_tokens").notNull().default(0),
  totalCacheReadTokens: integer("total_cache_read_tokens").notNull().default(0),
  totalCacheWriteTokens: integer("total_cache_write_tokens").notNull().default(0),
  totalCostUsd: numeric("total_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  wallTimeMs: integer("wall_time_ms").notNull().default(0),
  aggregateF1: numeric("aggregate_f1", { precision: 6, scale: 4 }),
  perFieldScores: jsonb("per_field_scores"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const caseResults = pgTable("case_results", {
  id: serial("id").primaryKey(),
  runId: integer("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  transcriptId: text("transcript_id").notNull(),
  status: text("status").notNull().default("pending"),
  prediction: jsonb("prediction"),
  scores: jsonb("scores"),
  isSchemaInvalid: boolean("is_schema_invalid").notNull().default(false),
  hallucinationCount: integer("hallucination_count").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadInputTokens: integer("cache_read_input_tokens").notNull().default(0),
  cacheCreationInputTokens: integer("cache_creation_input_tokens").notNull().default(0),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  attempts: jsonb("attempts").notNull().default([]),
  wallTimeMs: integer("wall_time_ms").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
}, (t) => [uniqueIndex("case_results_run_transcript_idx").on(t.runId, t.transcriptId)]);

export const runsRelations = relations(runs, ({ many }) => ({
  cases: many(caseResults),
}));

export const caseResultsRelations = relations(caseResults, ({ one }) => ({
  run: one(runs, { fields: [caseResults.runId], references: [runs.id] }),
}));
