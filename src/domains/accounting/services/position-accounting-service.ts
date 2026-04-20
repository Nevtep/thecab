export class PositionAccountingService {
  determinePrecisionStatus(input: {
    positionInstanceId: string;
    records: Array<{
      ledgerRecordId: string;
      positionInstanceId: string | null;
      strategyId: string | null;
      eventType: string;
    }>;
    residuals: Array<{
      latestSourceLedgerRecordId: string | null;
      candidatePoolIds: string[];
    }>;
  }) {
    const positionRecords = input.records.filter((record) => record.positionInstanceId === input.positionInstanceId);
    if (positionRecords.length === 0) {
      return "rolled_up" as const;
    }

    const strategyId = positionRecords[0]?.strategyId ?? null;
    const hasUnscopedSibling = input.records.some(
      (record) =>
        record.strategyId === strategyId &&
        record.positionInstanceId == null &&
        !record.eventType.startsWith("external_")
    );

    const linkedResiduals = input.residuals.filter((residual) =>
      residual.latestSourceLedgerRecordId
        ? positionRecords.some((record) => record.ledgerRecordId === residual.latestSourceLedgerRecordId)
        : false
    );

    const hasAmbiguousResidual = linkedResiduals.some((residual) => residual.candidatePoolIds.length > 1);
    return hasUnscopedSibling || hasAmbiguousResidual ? "rolled_up" : "exact";
  }
}