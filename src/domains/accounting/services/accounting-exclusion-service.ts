import { type AccountingCoverageSummary, type MoneyValue } from "@/domains/accounting/model/accounting-snapshot";

function money(amount: string): MoneyValue {
  return {
    currency: "usd",
    amount
  };
}

export class AccountingExclusionService {
  buildCoverageSummary(input: {
    pricedValueUsd: string;
    excludedValueUsd?: string | null;
    reasonCodes?: string[];
    unpricedComponentsCount?: number;
  }): AccountingCoverageSummary {
    const hasExclusions = Boolean(
      (input.excludedValueUsd && input.excludedValueUsd !== "0") ||
        (input.unpricedComponentsCount ?? 0) > 0 ||
        (input.reasonCodes?.length ?? 0) > 0
    );

    return {
      coverageStatus: hasExclusions ? "partial" : "full",
      pricedValue: money(input.pricedValueUsd),
      excludedValue: input.excludedValueUsd ? money(input.excludedValueUsd) : null,
      unpricedComponentsCount: input.unpricedComponentsCount ?? 0,
      reasonCodes: [...new Set(input.reasonCodes ?? [])]
    };
  }

  buildDiscardedReasonCodes(discardedItems: Array<{ reasonCode: string }>) {
    return [...new Set(discardedItems.map((item) => item.reasonCode))];
  }
}