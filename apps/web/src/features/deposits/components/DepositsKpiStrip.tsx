"use client";

import { CabKpiStrip, CabMetricCard } from "@/design-system";
import { formatPercent, formatUsd } from "@/i18n/formatters";
import type { DepositsListSummary } from "@/features/deposits/deposits.types";

type DepositsKpiStripProps = {
  summary: DepositsListSummary;
  locale: string;
  labels: {
    totalDeposits: string;
    totalDepositsValue: string;
    currentValue: string;
    totalRewards: string;
    weightedAnnualizedReturn: string;
    capitalDeployed: string;
  };
};

export function DepositsKpiStrip({ summary, locale, labels }: DepositsKpiStripProps) {
  return (
    <CabKpiStrip>
      <CabMetricCard
        label={labels.totalDeposits}
        value={labels.totalDepositsValue}
      />
      <CabMetricCard
        label={labels.currentValue}
        value={formatUsd(summary.currentValueUsd, locale)}
      />
      <CabMetricCard
        label={labels.totalRewards}
        value={formatUsd(summary.totalRewardsUsd, locale)}
      />
      <CabMetricCard
        label={labels.weightedAnnualizedReturn}
        value={
          summary.weightedAnnualizedReturnPct !== null
            ? formatPercent(summary.weightedAnnualizedReturnPct, locale)
            : "—"
        }
      />
      <CabMetricCard
        label={labels.capitalDeployed}
        value={
          summary.capitalDeployedPctOfManual !== null
            ? formatPercent(summary.capitalDeployedPctOfManual, locale)
            : "—"
        }
      />
    </CabKpiStrip>
  );
}
