import { ENGINE_V2_VERSION, type ChainScopedWallet } from "./types";

export const TEST_ENGINE_V2_WALLET: ChainScopedWallet = {
  chainId: 8453,
  walletAddress: "0x0000000000000000000000000000000000000001",
};

export function createEngineV2TestRun(overrides: Partial<ChainScopedWallet> = {}) {
  return {
    ...TEST_ENGINE_V2_WALLET,
    ...overrides,
    collectionVersion: ENGINE_V2_VERSION,
  };
}
