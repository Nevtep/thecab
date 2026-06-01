import assert from "node:assert/strict";
import test from "node:test";

import { classificationFromSnapshot, classifyBaseTransaction } from "./base-classifiers";

const walletAddress = "0x0000000000000000000000000000000000000001";

test("classifyBaseTransaction identifies failed transactions", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      receipt_status: "0",
      internal_transactions: [{ error: "execution reverted" }],
    },
  });

  assert.equal(result.eventType, "failed_transaction");
  assert.equal(result.coverageStatus, "full");
});

test("classifyBaseTransaction identifies native cash-in without semantic guessing", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      value: "100",
      logs: [],
    },
  });

  assert.equal(result.eventType, "cash_in_native");
  assert.equal(result.eventFamily, "cashflow");
});

test("classifyBaseTransaction keeps unknown inbound token transfers partial", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      value: "0",
      logs: [
        {
          address: "0x0000000000000000000000000000000000000003",
          topic0: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          decoded_event: {
            params: [
              { name: "from", value: "0x0000000000000000000000000000000000000002" },
              { name: "to", value: walletAddress },
              { name: "amount", value: "1" },
            ],
          },
        },
      ],
    },
  });

  assert.equal(result.eventType, "inbound_token_transfer_needs_counterparty_label");
  assert.equal(result.coverageStatus, "partial");
});

test("classifyBaseTransaction excludes explicit spam and airdrop flags without guessing", () => {
  const spam = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x1",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      possible_spam: true,
    } as never,
  });
  const airdrop = classifyBaseTransaction({
    walletAddress,
    tx: {
      hash: "0x2",
      from_address: "0x0000000000000000000000000000000000000002",
      to_address: walletAddress,
      receipt_status: "1",
      airdrop: true,
    } as never,
  });

  assert.equal(spam.coverageStatus, "excluded");
  assert.equal(spam.eventType, "excluded_spam");
  assert.equal(airdrop.coverageStatus, "excluded");
  assert.equal(airdrop.eventType, "excluded_airdrop");
});

test("classificationFromSnapshot maps the shared research snapshot into Engine V2 event fields", () => {
  const result = classificationFromSnapshot({
    hash: "0x1",
    timestamp: "2026-01-01T00:00:00.000Z",
    blockNumber: 123,
    transactionIndex: 4,
    fromAddress: "0x0000000000000000000000000000000000000002",
    toAddress: walletAddress,
    selector: "0xa9059cbb",
    contractLabel: "USDC",
    contractName: "USD Coin",
    decodedFunction: "transfer",
    decodedArgs: [],
    transferCount: 1,
    inboundTransferCount: 1,
    outboundTransferCount: 0,
    approvalCount: 0,
    classification: "cash_in_native",
    confidence: "high",
    reason: "native transfer into wallet",
    needsResolution: false,
  });

  assert.equal(result.eventType, "cash_in_native");
  assert.equal(result.eventFamily, "cashflow");
  assert.equal(result.evidence.sourceClassifier, "decoded-history-snapshot");
  assert.equal(result.evidence.selector, "0xa9059cbb");
  assert.equal(result.evidence.decodedFunction, "transfer");
  assert.equal(result.evidence.transferCount, 1);
  assert.equal(result.metadataJson?.contractLabel, "USDC");
  assert.equal(result.metadataJson?.decodedFunction, "transfer");
});

test("classifyBaseTransaction carries snapshot-derived evidence for decoded protocol calls", () => {
  const result = classifyBaseTransaction({
    walletAddress,
    registry: new Map([
      [
        "0x0000000000000000000000000000000000000010",
        {
          chainId: 8453,
          address: "0x0000000000000000000000000000000000000010",
          label: "Test Router",
          protocol: "test",
          expectedKind: "router",
          fetchedAt: "2026-01-01T00:00:00.000Z",
          sources: {
            basescanApi: "",
            basescanCode: "",
          },
          source: {
            contractName: "Router",
            compilerVersion: null,
            optimizationUsed: null,
            runs: null,
            constructorArguments: null,
            evmVersion: null,
            library: null,
            licenseType: null,
            proxy: false,
            implementation: null,
            swarmSource: null,
          },
          abi: [
            {
              type: "function",
              name: "execute",
              stateMutability: "nonpayable",
              inputs: [],
              outputs: [],
            },
          ],
          warnings: [],
        },
      ],
    ]),
    tx: {
      hash: "0x1",
      from_address: walletAddress,
      to_address: "0x0000000000000000000000000000000000000010",
      receipt_status: "1",
      input: "0x61461954",
      logs: [],
    },
  });

  assert.equal(result.eventType, "router_execute");
  assert.equal(result.evidence.selector, "0x61461954");
  assert.equal(result.evidence.contractLabel, "Test Router");
  assert.equal(result.evidence.contractName, "Router");
  assert.equal(result.evidence.decodedFunction, "execute");
});
