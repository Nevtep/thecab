import assert from "node:assert/strict";
import test from "node:test";

import { classifyBaseTransaction } from "./base-classifiers";

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
