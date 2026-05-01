import { env } from "@test-evals/env/server";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export function createDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

export const db = createDb();

// Re-export schema tables so consumers don't need a direct drizzle-orm dep
export * from "./schema";

// Re-export common drizzle operators
export { eq, and, or, desc, asc, sql, inArray, isNull, isNotNull } from "drizzle-orm";
