import assert from "node:assert/strict";
import test from "node:test";

function ensureTestEnv() {
  process.env.MORALIS_API_KEY ??= "test-moralis-key";
  process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
  process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
  process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
  process.env.ANALYSIS_HISTORY_DAYS ??= "365";
  process.env.ANALYSIS_SLICE_DAYS ??= "90";
  process.env.ANALYSIS_STATUS_STALE_DAYS ??= "7";
}

ensureTestEnv();

test("isSuspiciousSpoofedTransferActivity flags spoofed spam outflows that were not sent by the wallet", async () => {
  const { isSuspiciousSpoofedTransferActivity } = await import("@/server/analysis/enginePersistence");

  assert.equal(isSuspiciousSpoofedTransferActivity({
    walletAddress: "0xwallet",
    category: "token send",
    methodLabel: "transfer",
    fromAddress: "0xspoofed",
    toAddress: "0xphishing",
    meaningfulOutflowCount: 1,
    suspiciousOutflowCount: 1,
    trustedOutflowCount: 0,
  }), true);
});

test("isSuspiciousSpoofedTransferActivity keeps legitimate wallet cash outs visible", async () => {
  const { isSuspiciousSpoofedTransferActivity } = await import("@/server/analysis/enginePersistence");

  assert.equal(isSuspiciousSpoofedTransferActivity({
    walletAddress: "0xwallet",
    category: "token send",
    methodLabel: "transfer",
    fromAddress: "0xwallet",
    toAddress: "0xrecipient",
    meaningfulOutflowCount: 1,
    suspiciousOutflowCount: 0,
    trustedOutflowCount: 1,
  }), false);
});