export type TraceAccumulator = {
  ledgerRecordIds: Set<string>;
  pricePointIds: Set<string>;
};

export function createTraceAccumulator(): TraceAccumulator {
  return {
    ledgerRecordIds: new Set<string>(),
    pricePointIds: new Set<string>()
  };
}

export function mergeTrace(target: TraceAccumulator, source: TraceAccumulator) {
  for (const ledgerRecordId of source.ledgerRecordIds) {
    target.ledgerRecordIds.add(ledgerRecordId);
  }

  for (const pricePointId of source.pricePointIds) {
    target.pricePointIds.add(pricePointId);
  }
}