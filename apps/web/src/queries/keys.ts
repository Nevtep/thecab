type BaseParams = {
  chainId: number;
  walletAddress?: string;
};

type OverviewParams = BaseParams & {
  range: string;
};

type PoolsParams = BaseParams & {
  filters?: Record<string, unknown>;
};

type StrategiesParams = BaseParams & {
  filters?: Record<string, unknown>;
};

type RewardsParams = BaseParams & {
  filters?: Record<string, unknown>;
};

export const queryKeys = {
  overview: ({ chainId, walletAddress, range }: OverviewParams) =>
    ["overview", chainId, walletAddress ?? "", range] as const,
  overviewShell: ({ chainId, walletAddress, range }: OverviewParams) =>
    ["overview-shell", chainId, walletAddress ?? "", range] as const,
  overviewActivity: ({ chainId, walletAddress, range }: OverviewParams) =>
    ["overview-activity", chainId, walletAddress ?? "", range] as const,
  overviewChart: ({ chainId, walletAddress, range }: OverviewParams) =>
    ["overview-chart", chainId, walletAddress ?? "", range] as const,
  overviewProtocolPositions: ({ chainId, walletAddress, range }: OverviewParams) =>
    ["overview-protocol-positions", chainId, walletAddress ?? "", range] as const,
  analysisStatus: ({ chainId, walletAddress }: BaseParams) =>
    ["analysis-status", chainId, walletAddress ?? ""] as const,
  pools: ({ chainId, walletAddress, filters }: PoolsParams) =>
    ["pools", chainId, walletAddress ?? "", JSON.stringify(filters ?? {})] as const,
  poolDetail: (chainId: number, poolId: string, range = "90d") =>
    ["pool", chainId, poolId, range] as const,
  deposits: ({ chainId, walletAddress, filters }: BaseParams & { filters?: Record<string, unknown> }) =>
    ["deposits", chainId, walletAddress ?? "", JSON.stringify(filters ?? {})] as const,
  depositDetail: (chainId: number, depositId: string) =>
    ["deposit", chainId, depositId] as const,
  strategies: ({ chainId, walletAddress, filters }: StrategiesParams) =>
    ["strategies", chainId, walletAddress ?? "", JSON.stringify(filters ?? {})] as const,
  strategyDetail: (chainId: number, strategyId: string) =>
    ["strategy", chainId, strategyId] as const,
  rewards: ({ chainId, walletAddress, filters }: RewardsParams) =>
    ["rewards", chainId, walletAddress ?? "", JSON.stringify(filters ?? {})] as const,
  governance: ({ chainId, walletAddress }: BaseParams) =>
    ["governance", chainId, walletAddress ?? ""] as const,
  activity: ({ chainId, walletAddress }: BaseParams) =>
    ["activity", chainId, walletAddress ?? ""] as const,
  settings: ({ chainId, walletAddress }: BaseParams) =>
    ["settings", chainId, walletAddress ?? ""] as const,
};
