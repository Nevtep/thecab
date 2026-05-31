import assert from "node:assert/strict";
import test from "node:test";

import {
  ExplorerClientError,
  fetchExplorerContractSource,
  fetchExplorerTransactionEvidence,
  fetchExplorerTransactionReceipt,
} from "@/server/providers/explorer/client";

const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function jsonResponse(body: Record<string, unknown>, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

test("fetchExplorerTransactionReceipt requests BaseScan with chain-scoped API key", async () => {
  let requestedUrl = "";
  const receipt = await fetchExplorerTransactionReceipt({
    chainId: 8453,
    txHash,
    apiKey: "test-key",
    fetcher: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({ result: { transactionHash: txHash, logs: [] } });
    },
  });

  assert.equal(receipt.transactionHash, txHash);
  assert.ok(requestedUrl.includes("api.basescan.org/api"));
  assert.ok(requestedUrl.includes("action=eth_getTransactionReceipt"));
  assert.ok(requestedUrl.includes("apikey=test-key"));
});

test("fetchExplorerTransactionEvidence returns a gap result when credentials are missing", async () => {
  const evidence = await fetchExplorerTransactionEvidence({
    chainId: 8453,
    txHash,
    apiKey: null,
    fetcher: async () => {
      throw new Error("should not fetch");
    },
  });

  assert.equal(evidence.receipt, null);
  assert.deepEqual(evidence.evidenceGapReasonCodes, ["missingExplorerCredentials"]);
  assert.equal(evidence.sourceRefs[0]?.status, "missing_credentials");
});

test("fetchExplorerTransactionEvidence records rate-limit gaps without throwing", async () => {
  const evidence = await fetchExplorerTransactionEvidence({
    chainId: 8453,
    txHash,
    apiKey: "test-key",
    fetcher: async () => jsonResponse({ status: "0", message: "Max rate limit reached" }),
  });

  assert.equal(evidence.receipt, null);
  assert.ok(evidence.evidenceGapReasonCodes.includes("explorerRateLimited"));
});

test("fetchExplorerTransactionReceipt rejects malformed responses and unsupported chains", async () => {
  await assert.rejects(
    fetchExplorerTransactionReceipt({
      chainId: 8453,
      txHash,
      apiKey: "test-key",
      fetcher: async () => jsonResponse({ result: null }),
    }),
    (error) => error instanceof ExplorerClientError && error.code === "malformed_response",
  );

  await assert.rejects(
    fetchExplorerTransactionReceipt({
      chainId: 1,
      txHash,
      apiKey: "test-key",
      fetcher: async () => jsonResponse({ result: {} }),
    }),
    /UNSUPPORTED_CHAIN/,
  );
});

test("fetchExplorerContractSource requests contract interaction evidence", async () => {
  const result = await fetchExplorerContractSource({
    chainId: 8453,
    address: "0x1111111111111111111111111111111111111111",
    apiKey: "test-key",
    fetcher: async () => jsonResponse({ result: [{ ContractName: "Router" }] }),
  });

  assert.equal(result[0]?.ContractName, "Router");
});
