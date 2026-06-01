import { task } from "@trigger.dev/sdk/v3";

import { classifyTransactionsChronologically } from "@/server/analysis/engine-v2/classification";
import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { engineV2WalletPayloadSchema } from "@/server/analysis/engine-v2/payloads";

export type EngineV2ClassificationDeps = {
  loadTransactions?: (input: { chainId: number; walletAddress: string }) => Promise<MoralisDecodedTransaction[]>;
  loadRegistry?: (input: { chainId: number; walletAddress: string }) => Promise<Map<Address, AbiRegistryEntry>>;
  persistClassifications?: (items: ReturnType<typeof classifyTransactionsChronologically>) => Promise<void>;
};

export async function runEngineV2ClassifyChronological(
  rawPayload: unknown,
  deps: EngineV2ClassificationDeps = {},
) {
  const payload = engineV2WalletPayloadSchema.parse(rawPayload);
  const transactions = await (deps.loadTransactions?.(payload) ?? Promise.resolve([]));
  const registry = await (deps.loadRegistry?.(payload) ?? Promise.resolve(new Map<Address, AbiRegistryEntry>()));
  const classified = classifyTransactionsChronologically({
    transactions,
    walletAddress: payload.walletAddress as Address,
    registry,
  });
  await deps.persistClassifications?.(classified);

  return {
    classifiedCount: classified.length,
    eventTypes: classified.map((item) => item.classification.eventType),
  };
}

export const engineV2ClassifyChronologicalTask = task({
  id: "engine-v2-classify-chronological",
  run: async (payload: unknown) => runEngineV2ClassifyChronological(payload),
});
