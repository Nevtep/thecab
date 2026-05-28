"use client";

import { useTranslation } from "react-i18next";

import { CabBadge, CabCard, CabImpactMetricCard, CabStack, CabText } from "@/design-system";
import { CabTooltip } from "@/design-system/primitives/CabTooltip";
import { cabColors } from "@/design-system/tokens";
import { mapDepositUnattributedReasonLabels } from "@/features/deposits/deposits.mappers";
import type { DepositPerformanceDecompositionView } from "@/features/deposits/deposits.types";
import { formatPercent, formatUsd } from "@/i18n/formatters";

type DepositPerformanceDecompositionProps = {
  decomposition: DepositPerformanceDecompositionView;
  capitalEnteredUsd: number;
  capitalWithdrawnUsd: number;
  estimatedAnnualizedReturnPct: number | null;
  locale: string;
  labels: {
    title: string;
    totalReturn: string;
    estAnnualizedReturn: string;
    capitalEntered: string;
    capitalWithdrawn: string;
    components: Record<string, string>;
  };
};

function componentRows(input: DepositPerformanceDecompositionView) {
  return [
    ["rewardsUsd", input.rewardsUsd],
    ["feesUsd", input.feesUsd],
    ["assetPriceEffectUsd", input.assetPriceEffectUsd],
    ["rebalanceEffectUsd", input.rebalanceEffectUsd],
    ["realizedPnlUsd", input.realizedPnlUsd],
    ["unrealizedPnlUsd", input.unrealizedPnlUsd],
    ["unattributedUsd", input.unattributedUsd],
  ] as const;
}

export function DepositPerformanceDecomposition(input: DepositPerformanceDecompositionProps) {
  const { t } = useTranslation(["deposits", "coverage"]);
  const rows = componentRows(input.decomposition);
  const unattributedReasonLabels = mapDepositUnattributedReasonLabels({
    reasonCodes: input.decomposition.unattributedReasonCodes,
    translate: (key, options) => t(key, { defaultValue: options?.defaultValue ?? key }),
  });
  const unattributedTooltip = unattributedReasonLabels.length > 0
    ? unattributedReasonLabels.join(" • ")
    : t("deposits:unattributed.explainer");

  return (
    <CabCard density="spacious">
      <CabStack gap="$3">
        <CabText variant="label">{input.labels.title}</CabText>
        <CabText variant="caption">{t("deposits:detail.decomposition.flow.context")}</CabText>
        <CabStack row gap="$3" flexWrap="wrap">
          <CabImpactMetricCard
            label={input.labels.capitalEntered}
            value={formatUsd(input.capitalEnteredUsd, input.locale)}
            iconName="dashboard"
            accentColor={cabColors.brandExtended.signalTealRaw}
            size="compact"
          />
          <CabImpactMetricCard
            label={input.labels.capitalWithdrawn}
            value={formatUsd(input.capitalWithdrawnUsd, input.locale)}
            iconName="activity"
            accentColor={cabColors.dataViz.orange}
            size="compact"
          />
        </CabStack>
        <CabStack gap="$2">
          {rows.map(([key, value]) => (
            <CabStack key={key} row justifyContent="space-between" alignItems="center">
              {key === "unattributedUsd" ? (
                <CabTooltip label={unattributedTooltip}>
                  <span>
                    <CabText variant="caption">{input.labels.components[key]}</CabText>
                  </span>
                </CabTooltip>
              ) : (
                <CabText variant="caption">{input.labels.components[key]}</CabText>
              )}
              <CabStack row gap="$2" alignItems="center">
                <CabText variant="label">{formatUsd(value, input.locale)}</CabText>
                {key === "unattributedUsd" ? (
                  <CabTooltip label={unattributedTooltip}>
                    <span>
                      <CabBadge tone="warning">
                        {input.decomposition.totalReturnUsd === 0
                          ? "—"
                          : formatPercent(value / input.decomposition.totalReturnUsd, input.locale)}
                      </CabBadge>
                    </span>
                  </CabTooltip>
                ) : (
                  <CabBadge tone="info">
                    {input.decomposition.totalReturnUsd === 0
                      ? "—"
                      : formatPercent(value / input.decomposition.totalReturnUsd, input.locale)}
                  </CabBadge>
                )}
              </CabStack>
            </CabStack>
          ))}
        </CabStack>
        <CabStack row justifyContent="space-between" alignItems="center">
          <CabText variant="label">{input.labels.totalReturn}</CabText>
          <CabText variant="heading">{formatUsd(input.decomposition.totalReturnUsd, input.locale)}</CabText>
        </CabStack>
        <CabStack row justifyContent="space-between" alignItems="center">
          <CabText variant="caption">{input.labels.estAnnualizedReturn}</CabText>
          <CabText variant="label">
            {input.estimatedAnnualizedReturnPct === null ? "—" : formatPercent(input.estimatedAnnualizedReturnPct, input.locale)}
          </CabText>
        </CabStack>
      </CabStack>
    </CabCard>
  );
}