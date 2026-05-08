import type { AccountingResponse } from "@/domains/accounting/contracts/accounting-api-schemas";
import { DashboardReconciliationService } from "@/domains/accounting/services/dashboard-reconciliation-service";

export class AccountingBreakdownService {
  private readonly reconciliationService = new DashboardReconciliationService();

  buildPoolList(snapshot: AccountingResponse) {
    for (const pool of snapshot.pools) {
      this.reconciliationService.assertPoolStrategyReconciliation(pool);
    }

    this.reconciliationService.assertPortfolioReconciliation({
      totalValue: snapshot.totalValue,
      pools: snapshot.pools,
      idleResidualValue: snapshot.idleBalanceValue
    });

    return snapshot.pools;
  }

  buildPoolDetail(snapshot: AccountingResponse, poolId: string) {
    const pool = snapshot.pools.find((entry) => entry.poolId === poolId) ?? null;
    if (!pool) {
      return null;
    }

    this.reconciliationService.assertPoolStrategyReconciliation(pool);

    return pool;
  }
}
