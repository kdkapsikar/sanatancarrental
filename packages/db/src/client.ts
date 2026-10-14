import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readEnv } from "@cab/config";
import * as schema from "./schema/index.js";

export function createDb(url: string = readEnv().DATABASE_URL) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  return { db: drizzle(client, { schema }), client };
}
export type Db = ReturnType<typeof createDb>["db"];
