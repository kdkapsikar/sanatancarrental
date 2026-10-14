import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createDb } from "./client.js";

const url = process.argv[2] ?? process.env["DATABASE_URL"];
const { db, client } = createDb(url);
try {
  // Extensions first: drizzle-kit does not manage them and 0000 uses geography().
  await client.unsafe("CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await migrate(db, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  console.log("migrations applied");
} finally {
  await client.end();
}
