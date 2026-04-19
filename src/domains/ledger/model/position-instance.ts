export type PositionType = "manual_cl" | "mellow_exposure";
export type PositionStatus = "open" | "partially_reduced" | "closed" | "burned" | "archived";

export type PositionInstance = {
  positionInstanceId: string;
  strategyId: string;
  positionType: PositionType;
  status: PositionStatus;
  openedAt: Date;
  closedAt: Date | null;
  openTxHash: string;
  closeTxHash: string | null;
  tokenId: string | null;
  tickLower: number | null;
  tickUpper: number | null;
  wrapperAddress: string | null;
  stakingRewardsAddress: string | null;
  shareBalanceRaw: string | null;
  lifecycleSequence: number;
};

export type PositionIdentity = {
  identityReference: string;
  positionInstanceId: string;
  strategyId: string;
  positionType: PositionType;
};