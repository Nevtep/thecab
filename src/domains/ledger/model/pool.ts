export type StrategyType = "manual" | "mellow_auto";

export type Pool = {
  poolId: string;
  chainId: number;
  protocolFamily: string;
  poolAddress: string;
  token0Address: string;
  token1Address: string;
  feeTier: number | null;
  displayName: string;
  status: "active" | "historical";
};

export type Strategy = {
  strategyId: string;
  poolId: string;
  strategyType: StrategyType;
  sourceContractAddress: string | null;
  label: string;
  status: "active" | "historical";
};