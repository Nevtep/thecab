import type { AccountingResponse } from "@/domains/accounting/contracts/accounting-api-schemas";

export class AccountingBootstrapService {
  mapOverviewSnapshot(snapshot: AccountingResponse | null): AccountingResponse | null {
    if (!snapshot) {
      return null;
    }

    return {
      ...snapshot,
      idleBalanceValue: snapshot.idleBalanceValue,
      totalValue: snapshot.totalValue,
      capitalEntered: snapshot.capitalEntered,
      capitalWithdrawn: snapshot.capitalWithdrawn,
      realizedPnl: snapshot.realizedPnl,
      unrealizedPnl: snapshot.unrealizedPnl
    };
  }
}
