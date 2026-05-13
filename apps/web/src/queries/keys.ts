type BaseParams = {
  chainId: number;
  walletAddress?: string;
};

export const queryKeys = {
  overview: ({ chainId, walletAddress }: BaseParams) =>
    ["overview", chainId, walletAddress ?? ""] as const,
  analysisStatus: ({ chainId, walletAddress }: BaseParams) =>
    ["analysis-status", chainId, walletAddress ?? ""] as const,
  pools: ({ chainId, walletAddress }: BaseParams) =>
    ["pools", chainId, walletAddress ?? ""] as const,
  poolDetail: (chainId: number, poolId: string) => ["pool", chainId, poolId] as const,
  deposits: ({ chainId, walletAddress }: BaseParams) =>
    ["deposits", chainId, walletAddress ?? ""] as const,
  depositDetail: (chainId: number, depositId: string) =>
    ["deposit", chainId, depositId] as const,
  strategies: ({ chainId, walletAddress }: BaseParams) =>
    ["strategies", chainId, walletAddress ?? ""] as const,
  strategyDetail: (chainId: number, strategyId: string) =>
    ["strategy", chainId, strategyId] as const,
  rewards: ({ chainId, walletAddress }: BaseParams) =>
    ["rewards", chainId, walletAddress ?? ""] as const,
  governance: ({ chainId, walletAddress }: BaseParams) =>
    ["governance", chainId, walletAddress ?? ""] as const,
  activity: ({ chainId, walletAddress }: BaseParams) =>
    ["activity", chainId, walletAddress ?? ""] as const,
  settings: ({ chainId, walletAddress }: BaseParams) =>
    ["settings", chainId, walletAddress ?? ""] as const,
};
