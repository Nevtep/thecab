import { getDb } from "@/server/db/client";

import type { EngineV2Repositories, EngineV2RepositoryContext } from "./types";

export function createEngineV2Repositories(
  context: Partial<EngineV2RepositoryContext> = {},
): EngineV2Repositories {
  const db = context.db ?? getDb();
  void db;

  return {
    canonical: { kind: "canonical" },
    abi: { kind: "abi" },
    domain: { kind: "domain" },
    enrichment: { kind: "enrichment" },
    accounting: { kind: "accounting" },
    readModels: { kind: "read-model" },
  };
}

export type { EngineV2Repositories, EngineV2RepositoryContext } from "./types";
