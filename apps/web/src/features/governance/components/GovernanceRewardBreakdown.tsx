"use client";

import { CabCard, CabDonutChart, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  breakdown: GovernanceViewModel["rewardBreakdown"];
  labels: {
    title: string;
    subtitle: string;
    empty: string;
    total: string;
    getRewardType: (value: string) => string;
    formatUsd: (value: string | null) => string;
    formatPercent: (value: string | null) => string;
  };
};

const segmentColors = [
  cabColors.brand.signalTeal,
  cabColors.dataViz.violet,
  cabColors.brand.cabGold,
  cabColors.semantic.info,
  cabColors.text.muted,
];

export function GovernanceRewardBreakdown({ breakdown, labels }: Props) {
  const segments = breakdown.segments.filter((segment) => Number(segment.valueUsd ?? 0) > 0);
  const total = Number(breakdown.totalValueUsd ?? 0);

  if (segments.length === 0) {
    return (
      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.title}</CabText>
          <CabText variant="body" color={cabColors.text.secondary}>{labels.empty}</CabText>
        </CabStack>
      </CabCard>
    );
  }

  return (
    <div className={styles.breakdownLayout}>
      <CabDonutChart
        title={labels.title}
        subtitle={labels.subtitle}
        height={260}
        data={segments.map((segment, index) => ({
          id: segment.rewardType,
          label: labels.getRewardType(segment.rewardType),
          value: Number(segment.valueUsd ?? 0),
          color: segmentColors[index % segmentColors.length],
        }))}
        valueFormatter={(value) => labels.formatUsd(String(value))}
        centerContent={
          <CabStack gap="$1" alignItems="center">
            <CabText variant="kpi" fontSize={18} className={styles.mono}>
              {labels.formatUsd(breakdown.totalValueUsd)}
            </CabText>
            <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>{labels.total}</CabText>
          </CabStack>
        }
      />
      <CabCard density="compact">
        <CabStack className={styles.breakdownLegend}>
          {segments.map((segment, index) => {
            const color = segmentColors[index % segmentColors.length];
            const width = total > 0 ? Math.max(4, (Number(segment.valueUsd ?? 0) / total) * 100) : 0;
            return (
              <CabStack key={segment.rewardType} gap="$1">
                <div className={styles.legendRow}>
                  <span className={styles.legendDot} style={{ backgroundColor: color }} />
                  <CabText variant="label" fontSize={12}>{labels.getRewardType(segment.rewardType)}</CabText>
                  <CabText variant="mono" fontSize={12}>{labels.formatPercent(segment.percent)}</CabText>
                  <CabText variant="mono" fontSize={12}>{labels.formatUsd(segment.valueUsd)}</CabText>
                </div>
                <div className={styles.miniBar}>
                  <div className={styles.miniBarFill} style={{ width: `${width}%`, backgroundColor: color }} />
                </div>
              </CabStack>
            );
          })}
        </CabStack>
      </CabCard>
    </div>
  );
}
