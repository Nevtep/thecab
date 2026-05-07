export type DiscoveredWalletActivity = {
  txHash: string;
  blockNumber: bigint;
  transactionIndex: number | null;
  sourceKind: "native" | "internal" | "erc20" | "erc721";
  timestamp: Date | null;
};

export interface WalletActivityDiscoveryProvider {
  readonly providerKey: string;

  isConfigured(): boolean;
  discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<DiscoveredWalletActivity[]>;
}