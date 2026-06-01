import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/server/db/schema";

export type EngineV2Db = NodePgDatabase<typeof schema>;

export type EngineV2RepositoryContext = {
  db: EngineV2Db;
};

export type EngineV2CanonicalRepository = {
  readonly kind: "canonical";
};

export type EngineV2AbiRepository = {
  readonly kind: "abi";
};

export type EngineV2DomainRepository = {
  readonly kind: "domain";
};

export type EngineV2EnrichmentRepository = {
  readonly kind: "enrichment";
};

export type EngineV2AccountingRepository = {
  readonly kind: "accounting";
};

export type EngineV2ReadModelRepository = {
  readonly kind: "read-model";
};

export type EngineV2Repositories = {
  canonical: EngineV2CanonicalRepository;
  abi: EngineV2AbiRepository;
  domain: EngineV2DomainRepository;
  enrichment: EngineV2EnrichmentRepository;
  accounting: EngineV2AccountingRepository;
  readModels: EngineV2ReadModelRepository;
};
