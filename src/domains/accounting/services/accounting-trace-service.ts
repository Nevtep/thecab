export class AccountingTraceService {
  buildTraceRefs(input: {
    ledgerRecordIds?: string[];
    pricePointIds?: string[];
  }) {
    return {
      ledgerRecordIds: [...new Set(input.ledgerRecordIds ?? [])],
      pricePointIds: [...new Set(input.pricePointIds ?? [])]
    };
  }
}