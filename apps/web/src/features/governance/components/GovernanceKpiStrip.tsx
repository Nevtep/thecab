"use client";

import { CabBox, CabImpactMetricCard, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type KpiDefinition = {
  id: keyof GovernanceViewModel["summary"] | "coverage";
  labelKey: string;
  iconName: "lock" | "governance" | "coins" | "radar";
  accentColor: string;
};

const kpis: KpiDefinition[] = [
  { id: "lockedAero", labelKey: "governance:kpis.lockedAero", iconName: "lock", accentColor: cabColors.brand.signalTeal },
  { id: "veAeroExposure", labelKey: "governance:kpis.veAeroExposure", iconName: "governance", accentColor: cabColors.brand.electricBlue },
  { id: "lockExpiry", labelKey: "governance:kpis.lockExpiry", iconName: "lock", accentColor: cabColors.brand.cabGold },
  { id: "governanceRewardsClaimedUsd", labelKey: "governance:kpis.governanceRewards", iconName: "coins", accentColor: cabColors.semantic.info },
  { id: "estimatedGovernanceReturn", labelKey: "governance:kpis.estimatedReturn", iconName: "radar", accentColor: cabColors.dataViz.violet },
  { id: "coverage", labelKey: "governance:kpis.coverage", iconName: "radar", accentColor: cabColors.semantic.success },
];

type Props = {
  summary: GovernanceViewModel["summary"];
  labels: {
    getLabel: (key: string) => string;
    formatValue: (id: KpiDefinition["id"]) => string;
    getMeta: (id: KpiDefinition["id"]) => string | null;
  };
};

export function GovernanceKpiStrip({ summary: _summary, labels }: Props) {
  return (
    <CabBox className={styles.kpiGrid}>
      {kpis.map((kpi, index) => (
        <CabImpactMetricCard
          key={kpi.id}
          label={labels.getLabel(kpi.labelKey)}
          value={labels.formatValue(kpi.id)}
          iconName={kpi.iconName}
          accentColor={kpi.accentColor}
          meta={labels.getMeta(kpi.id)}
          series={index < 3 ? [1, 2, 2, 3, 2, 4, 3] : [2, 3, 2, 4, 5, 4, 6]}
          size="compact"
        />
      ))}
    </CabBox>
  );
}
