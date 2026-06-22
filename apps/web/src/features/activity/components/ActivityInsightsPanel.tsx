"use client";

import { CabBarChart, CabBox, CabDonutChart, CabStack, CabText, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  charts: ActivityViewModel["charts"];
  labels: {
    timelineTitle: string;
    timelineSubtitle: string;
    actionTitle: string;
    actionSubtitle: string;
    totalEvents: string;
    getAction: (value: string) => string;
    getSurface: (value: string) => string;
    getMovement: (value: string) => string;
    formatCount: (value: number) => string;
    formatUsd: (value: string) => string;
  };
};

const timelineColors = {
  protocolActivity: cabColors.brand.signalTeal,
  walletCashflow: cabColors.brand.electricBlue,
  approvals: cabColors.brand.cabGold,
  other: cabColors.text.muted,
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
  const totalActionEvents = charts.actionBreakdown.reduce((sum, entry) => sum + entry.value, 0);
  const donutData = charts.actionBreakdown.slice(0, 8).map((entry, index) => ({
    id: entry.id,
    label: labels.getAction(entry.id),
    value: entry.value,
    color: surfaceColors[index % surfaceColors.length],
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
          { key: "protocolActivity", label: labels.getAction("strategy"), color: timelineColors.protocolActivity },
          { key: "walletCashflow", label: labels.getMovement("in"), color: timelineColors.walletCashflow },
          { key: "approvals", label: labels.getAction("approval"), color: timelineColors.approvals },
          { key: "other", label: labels.getAction("ambiguous"), color: timelineColors.other },
        ]}
      />
      <CabDonutChart
        title={labels.actionTitle}
        subtitle={labels.actionSubtitle}
        height={128}
        data={donutData}
        valueFormatter={labels.formatCount}
        centerContent={
          <CabStack alignItems="center" gap="$1">
            <CabText variant="kpi" fontSize={18}>
              {labels.formatCount(totalActionEvents)}
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
              {charts.movementBreakdown.slice(0, 3).map((entry) => (
                <CabStack key={`movement-${entry.id}`} row alignItems="center" justifyContent="space-between" gap="$2">
                  <CabStack row alignItems="center" gap="$2" minWidth={0}>
                    <span className={styles.legendDot} style={{ backgroundColor: cabColors.brand.cabGold }} />
                    <CabText variant="caption" fontSize={11}>
                      {labels.getMovement(entry.id)}
                    </CabText>
                  </CabStack>
                  <CabText variant="mono" fontSize={11} color={cabColors.text.secondary}>
                    {labels.formatCount(entry.value)} / {labels.formatUsd(entry.valueUsd)}
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
