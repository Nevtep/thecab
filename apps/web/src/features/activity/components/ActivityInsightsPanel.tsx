"use client";

import { CabBarChart, CabBox, CabDonutChart, CabStack, CabText, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  charts: ActivityViewModel["charts"];
  labels: {
    timelineTitle: string;
    timelineSubtitle: string;
    coverageTitle: string;
    coverageSubtitle: string;
    totalEvents: string;
    getCoverage: (value: string) => string;
    getSurface: (value: string) => string;
    formatCount: (value: number) => string;
  };
};

const coverageColors = {
  full: cabColors.semantic.success,
  partial: cabColors.brand.cabGold,
  unresolved: cabColors.semantic.warning,
  excluded: cabColors.semantic.danger,
  unavailable: cabColors.text.muted,
} as const;

const surfaceColors = [
  cabColors.brand.signalTeal,
  cabColors.brand.electricBlue,
  cabColors.brand.cabGold,
  cabColors.semantic.warning,
  cabColors.semantic.danger,
  cabColors.text.muted,
];

export function ActivityInsightsPanel({ charts, labels }: Props) {
  const totalCoverageEvents = charts.coverageBreakdown.reduce((sum, entry) => sum + entry.value, 0);
  const donutData = charts.coverageBreakdown.map((entry) => ({
    id: entry.id,
    label: labels.getCoverage(entry.id),
    value: entry.value,
    color: coverageColors[entry.id],
  }));
  const surfaceLegend = charts.surfaceBreakdown.slice(0, 5).map((entry, index) => ({
    ...entry,
    color: surfaceColors[index % surfaceColors.length],
  }));

  return (
    <CabBox className={styles.insightsGrid}>
      <CabBarChart
        title={labels.timelineTitle}
        subtitle={labels.timelineSubtitle}
        height={128}
        data={charts.timeline}
        xKey="label"
        series={[
          { key: "full", label: labels.getCoverage("full"), color: coverageColors.full },
          { key: "partial", label: labels.getCoverage("partial"), color: coverageColors.partial },
          { key: "unresolved", label: labels.getCoverage("unresolved"), color: coverageColors.unresolved },
          { key: "excluded", label: labels.getCoverage("excluded"), color: coverageColors.excluded },
        ]}
      />
      <CabDonutChart
        title={labels.coverageTitle}
        subtitle={labels.coverageSubtitle}
        height={128}
        data={donutData}
        valueFormatter={labels.formatCount}
        centerContent={
          <CabStack alignItems="center" gap="$1">
            <CabText variant="kpi" fontSize={18}>
              {labels.formatCount(totalCoverageEvents)}
            </CabText>
            <CabText variant="caption" fontSize={10} color={cabColors.text.muted}>
              {labels.totalEvents}
            </CabText>
          </CabStack>
        }
        footerContent={
          surfaceLegend.length > 0 ? (
            <CabStack className={styles.surfaceLegend}>
              {surfaceLegend.map((entry) => (
                <CabStack key={entry.id} row alignItems="center" justifyContent="space-between" gap="$2">
                  <CabStack row alignItems="center" gap="$2" minWidth={0}>
                    <span className={styles.legendDot} style={{ backgroundColor: entry.color }} />
                    <CabText variant="caption" fontSize={11}>
                      {labels.getSurface(entry.id)}
                    </CabText>
                  </CabStack>
                  <CabText variant="mono" fontSize={11} color={cabColors.text.secondary}>
                    {labels.formatCount(entry.value)}
                  </CabText>
                </CabStack>
              ))}
            </CabStack>
          ) : null
        }
      />
    </CabBox>
  );
}
