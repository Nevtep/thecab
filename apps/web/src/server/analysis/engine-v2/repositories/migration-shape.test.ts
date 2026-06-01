import assert from "node:assert/strict";
import test from "node:test";

import * as schema from "@/server/db/schema";

const requiredTables = [
  "engineV2CollectionRuns",
  "engineV2ProviderPages",
  "canonicalTransactions",
  "canonicalTransactionLogs",
  "canonicalInternalTransactions",
  "canonicalAssetMovements",
  "canonicalCalls",
  "contractAbis",
  "contractAbiSelectors",
  "engineV2ProtocolKnownAddresses",
  "engineV2ProtocolStateSnapshots",
  "engineV2DomainEvents",
  "engineV2DomainEventLinks",
  "engineV2ClassificationTraces",
  "engineV2EnrichmentNeeds",
  "engineV2GovernanceLocks",
  "engineV2ManagedLockLinks",
  "engineV2GovernanceClaimItems",
  "engineV2DistributorPoolLinks",
  "engineV2AccountingLots",
  "engineV2ResidualInventory",
  "engineV2ReadModelRows",
] as const;

test("Engine V2 schema exports required foundational tables", () => {
  for (const tableName of requiredTables) {
    assert.ok(schema[tableName], `${tableName} should be exported`);
  }
});
