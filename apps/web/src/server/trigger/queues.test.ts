import assert from "node:assert/strict";
import test from "node:test";

function ensureTestEnv() {
  process.env.MORALIS_API_KEY ??= "test-moralis-key";
  process.env.ALCHEMY_API_KEY ??= "test-alchemy-key";
  process.env.ALCHEMY_BASE_RPC_URL ??= "https://example.com";
  process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/thecab_test";
  process.env.TRIGGER_SECRET_KEY ??= "trigger_secret_test";
}

ensureTestEnv();

test("getTriggerQueueConcurrency exposes numeric concurrency values for provider queues", async () => {
  const { getTriggerQueueConcurrency, TRIGGER_QUEUE_NAMES } = await import("@/server/trigger/queues");

  const concurrency = getTriggerQueueConcurrency();

  assert.equal(typeof concurrency[TRIGGER_QUEUE_NAMES.moralis], "number");
  assert.equal(typeof concurrency[TRIGGER_QUEUE_NAMES.alchemyPrices], "number");
  assert.equal(typeof concurrency[TRIGGER_QUEUE_NAMES.alchemyRpc], "number");
  assert.equal(concurrency[TRIGGER_QUEUE_NAMES.moralis] > 0, true);
  assert.equal(concurrency[TRIGGER_QUEUE_NAMES.alchemyPrices] > 0, true);
  assert.equal(concurrency[TRIGGER_QUEUE_NAMES.alchemyRpc] > 0, true);
});

test("createProviderQueueOptions scopes each provider queue by chain id", async () => {
  const { createProviderQueueOptions, TRIGGER_QUEUE_NAMES } = await import("@/server/trigger/queues");

  assert.deepEqual(createProviderQueueOptions(8453), {
    [TRIGGER_QUEUE_NAMES.moralis]: {
      queue: "moralis",
      concurrencyKey: "8453",
    },
    [TRIGGER_QUEUE_NAMES.alchemyPrices]: {
      queue: "alchemy-prices",
      concurrencyKey: "8453",
    },
    [TRIGGER_QUEUE_NAMES.alchemyRpc]: {
      queue: "alchemy-rpc",
      concurrencyKey: "8453",
    },
  });
});