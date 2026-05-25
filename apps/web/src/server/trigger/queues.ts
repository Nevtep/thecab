import { getEnv } from "@/server/env";

export const TRIGGER_QUEUE_NAMES = {
  moralis: "moralis",
  alchemyPrices: "alchemy-prices",
  alchemyRpc: "alchemy-rpc",
} as const;

export function getTriggerQueueConcurrency() {
  const env = getEnv();

  return {
    [TRIGGER_QUEUE_NAMES.moralis]: env.TRIGGER_QUEUE_MORALIS_CONCURRENCY,
    [TRIGGER_QUEUE_NAMES.alchemyPrices]: env.TRIGGER_QUEUE_ALCHEMY_PRICES_CONCURRENCY,
    [TRIGGER_QUEUE_NAMES.alchemyRpc]: env.TRIGGER_QUEUE_ALCHEMY_RPC_CONCURRENCY,
  };
}

export function createProviderQueueOptions(chainId: number) {
  return {
    [TRIGGER_QUEUE_NAMES.moralis]: {
      queue: TRIGGER_QUEUE_NAMES.moralis,
      concurrencyKey: String(chainId),
    },
    [TRIGGER_QUEUE_NAMES.alchemyPrices]: {
      queue: TRIGGER_QUEUE_NAMES.alchemyPrices,
      concurrencyKey: String(chainId),
    },
    [TRIGGER_QUEUE_NAMES.alchemyRpc]: {
      queue: TRIGGER_QUEUE_NAMES.alchemyRpc,
      concurrencyKey: String(chainId),
    },
  };
}