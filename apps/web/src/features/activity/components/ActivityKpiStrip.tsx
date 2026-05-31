"use client";

import { CabBox, CabImpactMetricCard, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  kpis: ActivityViewModel["kpis"];
  labels: {
    getLabel: (key: string) => string;
    formatValue: (kpi: ActivityViewModel["kpis"][number]) => string;
    getMeta: (labelKey: string | null) => string | null;
  };
};

const accents = [
  cabColors.brand.signalTeal,
  cabColors.semantic.info,
  cabColors.brand.cabGold,
  cabColors.semantic.warning,
];

export function ActivityKpiStrip({ kpis, labels }: Props) {
  return (
    <CabBox className={styles.kpiGrid}>
      {kpis.map((kpi, index) => (
        <CabImpactMetricCard
          key={kpi.id}
          label={labels.getLabel(kpi.labelKey)}
          value={labels.formatValue(kpi)}
          iconName={kpi.id === "totalValue" ? "coins" : kpi.id === "coverage" ? "radar" : "activity"}
          accentColor={accents[index % accents.length]}
          meta={labels.getMeta(kpi.contextLabelKey)}
          series={[1, 2, 3, 2, 4, 3, 5]}
          size="compact"
        />
      ))}
    </CabBox>
  );
}
