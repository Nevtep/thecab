export type MaterializeStrategyReadModelsInput = {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
};

export type MaterializeStrategyReadModelsResult = {
  summariesDeleted: number;
  summariesInserted: number;
  historyDeleted: number;
  historyInserted: number;
  lifecycleDeleted: number;
  lifecycleInserted: number;
};

export async function materializeStrategyReadModels(
  input: MaterializeStrategyReadModelsInput,
): Promise<MaterializeStrategyReadModelsResult> {
  void input;

  return {
    summariesDeleted: 0,
    summariesInserted: 0,
    historyDeleted: 0,
    historyInserted: 0,
    lifecycleDeleted: 0,
    lifecycleInserted: 0,
  };
}
