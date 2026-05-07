export type DiscoveredWalletActivity = {
  txHash: string;
  blockNumber: bigint;
  transactionIndex: number | null;
  sourceKind: "native" | "internal" | "erc20" | "erc721" | "defi";
  timestamp: Date | null;
};

export type WalletActivityDiscoveryResult = {
  activities: DiscoveredWalletActivity[];
  providerCursor: string | null;
};

export interface WalletActivityDiscoveryProvider {
  readonly providerKey: string;

  isConfigured(): boolean;
  discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    providerCursor?: string | null;
  }): Promise<WalletActivityDiscoveryResult>;
}