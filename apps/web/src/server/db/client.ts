import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getEnv } from "@/server/env";
import * as schema from "@/server/db/schema";

let pool: Pool | null = null;
let dbClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (dbClient) return dbClient;

  const env = getEnv();
  pool = new Pool({ connectionString: env.DATABASE_URL });
  dbClient = drizzle(pool, { schema });

  return dbClient;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
    dbClient = null;
  }
}
