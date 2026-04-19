import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/infrastructure/db/schema";

type SqlClient = ReturnType<typeof postgres>;
type DrizzleDatabase = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __theCabSqlClient__: SqlClient | undefined;
  var __theCabDb__: DrizzleDatabase | undefined;
}

function requireDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for database access.");
  }

  return databaseUrl;
}

export function getSqlClient(): SqlClient {
  if (!global.__theCabSqlClient__) {
    global.__theCabSqlClient__ = postgres(requireDatabaseUrl(), {
      max: 1,
      prepare: false
    });
  }

  return global.__theCabSqlClient__;
}

export function getDb(): DrizzleDatabase {
  if (!global.__theCabDb__) {
    global.__theCabDb__ = drizzle(getSqlClient(), { schema });
  }

  return global.__theCabDb__;
}