"use client";

import { CabDonutChart, CabText, cabColors } from "@/design-system";
import type { RewardsDistribution } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = {
  distribution: RewardsDistribution;
  title: string;
  valueLabel: string;
  getLabel: (key: string) => string;
  formatUsd: (value: number) => string;
  activeFilter: {
    source: string;
    poolId: string | null;
    tokenAddress: string | null;
  };
  onOpenFilter: (target: Record<string, unknown>) => void;
};

const colors = [
  cabColors.brand.signalTeal,
  cabColors.brand.electricBlue,
  cabColors.brand.cabGold,
  cabColors.dataViz.emerald,
  cabColors.dataViz.violet,
];

function matchesActiveFilter(item: RewardsDistribution["items"][number], activeFilter: Props["activeFilter"]) {
  const target = item.filterTarget;
  if (typeof target.source === "string" && activeFilter.source === target.source) return true;
  if (typeof target.poolId === "string" && activeFilter.poolId === target.poolId) return true;
  if (typeof target.tokenAddress === "string" && activeFilter.tokenAddress === target.tokenAddress) return true;
  return false;
}

export function RewardsDistributionPanel({ distribution, title, valueLabel, getLabel, formatUsd, activeFilter, onOpenFilter }: Props) {
  const activeItemId = distribution.items.find((item) => matchesActiveFilter(item, activeFilter))?.id ?? null;
  const visibleItems = activeItemId
    ? distribution.items.filter((item) => item.id === activeItemId)
    : distribution.items.slice(0, 5);
  const chartItems = distribution.items.slice(0, 5);
  const hasChartValues = chartItems.some((item) => Number(item.valueUsd) > 0);
  const chartData = hasChartValues
    ? chartItems.map((item, index) => ({
        id: item.id,
        label: item.labelKey ? getLabel(item.labelKey) : item.label,
        value: Math.max(0, Number(item.valueUsd)),
        color: colors[index % colors.length],
      }))
    : [{ id: "empty", label: getLabel("rewards:empty.noRewardsTitle"), value: 1, color: cabColors.surface.border, opacity: 0.38 }];

  return (
    <CabDonutChart
      title={title}
      subtitle={`${valueLabel}: ${formatUsd(Number(distribution.totalUsd))}`}
      height={190}
      levels={[{
        data: chartData,
        innerRadius: 54,
        outerRadius: 84,
        paddingAngle: 2,
        cornerRadius: 5,
        valueFormatter: formatUsd,
        onSlicePress: (entry) => {
          const item = distribution.items.find((candidate) => candidate.id === entry.id);
          if (item) onOpenFilter(item.filterTarget);
        },
      }]}
      centerContent={(
        <div className={styles.donutCenter}>
          <CabText className={styles.numeric} variant="heading" fontSize={15}>{formatUsd(Number(distribution.totalUsd))}</CabText>
          <CabText fontSize={11} color="$muted">{valueLabel}</CabText>
        </div>
      )}
      footerContent={(
        <div className={styles.distributionLegend}>
          {visibleItems.length === 0 ? (
            <CabText fontSize={12} color="$secondary">{getLabel("rewards:empty.filteredTitle")}</CabText>
          ) : visibleItems.map((item, index) => {
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? `${styles.legendRow} ${styles.legendRowActive}` : styles.legendRow}
                onClick={() => onOpenFilter(item.filterTarget)}
              >
                <span className={styles.legendSwatch} style={{ background: colors[index % colors.length] }} aria-hidden="true" />
                <span className={styles.legendLabel}>{item.labelKey ? getLabel(item.labelKey) : item.label}</span>
                <span className={styles.legendValue}>{formatUsd(Number(item.valueUsd))}</span>
                <span className={styles.legendShare}>{item.sharePct}%</span>
              </button>
            );
          })}
        </div>
      )}
    />
  );
}
