"use client";

import { CabBadge, CabButton } from "@/design-system";
import { StrategyIdentityCell } from "@/features/strategies/components/StrategyIdentityCell";
import type { StrategyRowViewModel } from "@/features/strategies/strategies.mappers";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategiesTableProps = {
  items: StrategyRowViewModel[];
  labels: {
    strategy: string;
    status: string;
    currentValue: string;
    shares: string;
    rewards: string;
    result: string;
    apr: string;
    coverage: string;
    select: string;
  };
  getCoverageLabel: (coverage: StrategyRowViewModel["coverageStatus"]) => string;
  onSelect: (strategyExposureId: string) => void;
};

export function StrategiesTable({ items, labels, getCoverageLabel, onSelect }: StrategiesTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{labels.strategy}</th>
            <th>{labels.status}</th>
            <th>{labels.currentValue}</th>
            <th>{labels.shares}</th>
            <th>{labels.rewards}</th>
            <th>{labels.result}</th>
            <th>{labels.apr}</th>
            <th>{labels.coverage}</th>
            <th><span className={styles.srOnly}>{labels.select}</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.strategyExposureId} className={item.isSelected ? styles.selectedRow : undefined}>
              <td><StrategyIdentityCell item={item} /></td>
              <td><CabBadge size="sm" tone={item.status === "active" ? "success" : "neutral"}>{item.status}</CabBadge></td>
              <td>{item.formattedCurrentValue}</td>
              <td>{item.currentSharesRaw} {item.shareSymbol ?? ""}</td>
              <td>{item.formattedRewards}</td>
              <td className={styles[item.totalReturnSign]}>{item.formattedTotalReturn}</td>
              <td>{item.formattedApr}</td>
              <td><CabBadge size="sm" tone={item.coverageStatus === "full" ? "success" : "warning"}>{getCoverageLabel(item.coverageStatus)}</CabBadge></td>
              <td>
                <CabButton density="compact" tone="secondary" onPress={() => onSelect(item.strategyExposureId)}>
                  {labels.select}
                </CabButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

