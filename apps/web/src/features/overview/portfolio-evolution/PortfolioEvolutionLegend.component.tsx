"use client";

import { CabStack, CabText, cabColors } from "@/design-system";
import type { PortfolioEvolutionEventType } from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import {
  portfolioEvolutionEventMeta,
  portfolioEvolutionSeriesMeta,
  type PortfolioEvolutionSeriesKey,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import { useTranslation } from "react-i18next";

export type { PortfolioEvolutionSeriesKey } from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";

type PortfolioEvolutionLegendProps = {
  visibleSeries: Record<PortfolioEvolutionSeriesKey, boolean>;
  availableEventTypes: PortfolioEvolutionEventType[];
  visibleEventTypes: Partial<Record<PortfolioEvolutionEventType, boolean>>;
  onToggleSeries: (key: PortfolioEvolutionSeriesKey) => void;
  onToggleEventType: (key: PortfolioEvolutionEventType) => void;
};

function ToggleChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? color : "rgba(184, 199, 230, 0.16)"}`,
        background: active ? `${color}1A` : "rgba(15, 24, 38, 0.72)",
        color: active ? cabColors.text.primary : cabColors.text.secondary,
        cursor: "pointer",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          boxShadow: active ? `0 0 10px ${color}` : "none",
        }}
      />
      <span style={{ fontSize: 12, lineHeight: 1.1 }}>{label}</span>
    </button>
  );
}

export function PortfolioEvolutionLegend({
  visibleSeries,
  availableEventTypes,
  visibleEventTypes,
  onToggleSeries,
  onToggleEventType,
}: PortfolioEvolutionLegendProps) {
  const { t } = useTranslation(["overview", "charts"]);

  return (
    <CabStack gap="$3">
      <CabStack gap="$2">
        <CabText variant="caption" fontSize={11}>
          {t("portfolioEvolution.legend.series")}
        </CabText>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(Object.keys(portfolioEvolutionSeriesMeta) as PortfolioEvolutionSeriesKey[]).map((key) => (
            <ToggleChip
              key={key}
              label={t(portfolioEvolutionSeriesMeta[key].labelKey)}
              color={portfolioEvolutionSeriesMeta[key].color}
              active={visibleSeries[key]}
              onPress={() => onToggleSeries(key)}
            />
          ))}
        </div>
      </CabStack>

      {availableEventTypes.length > 0 ? (
        <CabStack gap="$2">
          <CabText variant="caption" fontSize={11}>
            {t("portfolioEvolution.legend.events")}
          </CabText>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availableEventTypes.map((eventType) => (
              <ToggleChip
                key={eventType}
                label={t(portfolioEvolutionEventMeta[eventType].labelKey)}
                color={portfolioEvolutionEventMeta[eventType].color}
                active={visibleEventTypes[eventType] ?? true}
                onPress={() => onToggleEventType(eventType)}
              />
            ))}
          </div>
        </CabStack>
      ) : null}
    </CabStack>
  );
}
