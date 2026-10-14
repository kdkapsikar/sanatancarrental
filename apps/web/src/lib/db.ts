import "server-only";
import { createDb, type Db } from "@cab/db";

const g = globalThis as unknown as { __cabDb?: Db };
/** One pool per server process (survives dev hot reloads). */
export const db: Db = g.__cabDb ?? (g.__cabDb = createDb().db);
