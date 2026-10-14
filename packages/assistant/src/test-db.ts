// Test helper: a dedicated, migrated and seeded database for assistant tests.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createDb } from "@cab/db";

export const TEST_URL =
  process.env["ASSISTANT_TEST_DATABASE_URL"] ?? "postgres://localhost:5433/cab_platform_test_assistant";

export async function testDb() {
  const url = new URL(TEST_URL);
  const dbName = url.pathname.slice(1);
  const admin = postgres({ host: url.hostname, port: Number(url.port || 5432), database: "postgres", max: 1, onnotice: () => {} });
  try {
    const [row] = await admin`select 1 from pg_database where datname = ${dbName}`;
    if (!row) await admin.unsafe(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }
  const dbPkg = fileURLToPath(new URL("../../db/src/", import.meta.url));
  const env = { ...process.env, DATABASE_URL: TEST_URL };
  execFileSync("npx", ["tsx", `${dbPkg}migrate.ts`, TEST_URL], { stdio: "pipe", env });
  execFileSync("npx", ["tsx", `${dbPkg}seed/index.ts`, TEST_URL], { stdio: "pipe", env });
  return createDb(TEST_URL);
}
