import assert from "node:assert/strict";
import test from "node:test";

test("provider boundary is not exported by the Engine V2 public barrel", async () => {
  const publicExports = await import("@/server/analysis/engine-v2");

  assert.equal("ENGINE_V2_PROVIDER_BOUNDARY" in publicExports, false);
  assert.equal("createProviderRequestDescriptor" in publicExports, false);
});

test("provider request descriptors keep provider calls analysis-scoped", async () => {
  const { ENGINE_V2_PROVIDER_BOUNDARY, createProviderRequestDescriptor } = await import(
    "@/server/analysis/engine-v2/providers"
  );

  assert.equal(ENGINE_V2_PROVIDER_BOUNDARY, "analysis-only");
  assert.deepEqual(
    createProviderRequestDescriptor({
      provider: "moralis",
      endpoint: "/api/v2.2/{address}/verbose",
      naturalKey: "8453:wallet:cursor",
      request: { chainId: 8453 },
    }),
    {
      provider: "moralis",
      endpoint: "/api/v2.2/{address}/verbose",
      naturalKey: "8453:wallet:cursor",
      request: { chainId: 8453 },
    },
  );
});
