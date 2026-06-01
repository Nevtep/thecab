import assert from "node:assert/strict";
import test from "node:test";

import { createEngineV2Repositories } from "@/server/analysis/engine-v2/repositories";

test("createEngineV2Repositories exposes stable repository groups", () => {
  const repositories = createEngineV2Repositories({ db: {} as never });

  assert.equal(repositories.canonical.kind, "canonical");
  assert.equal(repositories.abi.kind, "abi");
  assert.equal(repositories.domain.kind, "domain");
  assert.equal(repositories.enrichment.kind, "enrichment");
  assert.equal(repositories.accounting.kind, "accounting");
  assert.equal(repositories.readModels.kind, "read-model");
});
