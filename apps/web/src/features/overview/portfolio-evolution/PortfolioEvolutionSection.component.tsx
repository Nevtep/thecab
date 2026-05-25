"use client";

import { CabCard, CabEmptyState, CabStack, CabText } from "@/design-system";
import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";
import {
  PortfolioEvolutionChart,
} from "@/features/overview/portfolio-evolution/PortfolioEvolutionChart.component";
import { PortfolioEvolutionEventDetailsPanel } from "@/features/overview/portfolio-evolution/PortfolioEvolutionEventDetailsPanel.component";
import {
  PortfolioEvolutionHeader,
} from "@/features/overview/portfolio-evolution/PortfolioEvolutionHeader.component";
import {
  PortfolioEvolutionKpiStrip,
} from "@/features/overview/portfolio-evolution/PortfolioEvolutionKpiStrip.component";
import {
  PortfolioEvolutionLegend,
  type PortfolioEvolutionSeriesKey,
} from "@/features/overview/portfolio-evolution/PortfolioEvolutionLegend.component";
import {
  buildPortfolioEvolutionModel,
  type PortfolioEvolutionEventType,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionSectionProps = {
  viewModel: OverviewViewModel;
  activity: OverviewViewModel["activity"] | null;
  range: OverviewRange;
  locale: string;
  isRefreshing: boolean;
  onRangeChange: (range: OverviewRange) => void;
};

const defaultVisibleSeries: Record<PortfolioEvolutionSeriesKey, boolean> = {
  total: true,
  deployed: true,
  idle: true,
  rewards: true,
};

export function PortfolioEvolutionSection({
  viewModel,
  activity,
  range,
  locale,
  isRefreshing,
  onRangeChange,
}: PortfolioEvolutionSectionProps) {
  const { t } = useTranslation(["overview"]);
  const model = useMemo(
    () => buildPortfolioEvolutionModel({
      viewModel,
      activity,
      range,
      locale,
    }),
    [activity, locale, range, viewModel],
  );
  const [visibleSeries, setVisibleSeries] = useState(defaultVisibleSeries);
  const [visibleEventTypes, setVisibleEventTypes] = useState<Partial<Record<PortfolioEvolutionEventType, boolean>>>({});
  const [hoveredCapturedAt, setHoveredCapturedAt] = useState<string | null>(null);
  const [selectedCapturedAt, setSelectedCapturedAt] = useState<string | null>(null);

  useEffect(() => {
    setVisibleEventTypes((currentState) => {
      const nextState = { ...currentState };
      for (const eventType of model.availableEventTypes) {
        if (nextState[eventType] === undefined) {
          nextState[eventType] = true;
        }
      }

      return nextState;
    });
  }, [model.availableEventTypes]);

  useEffect(() => {
    if (selectedCapturedAt && !model.data.some((point) => point.capturedAt === selectedCapturedAt)) {
      setSelectedCapturedAt(null);
    }
  }, [model.data, selectedCapturedAt]);

  const filteredData = useMemo(
    () => model.data.map((point) => ({
      ...point,
      events: point.events.filter((event) => visibleEventTypes[event.type] ?? true),
    })),
    [model.data, visibleEventTypes],
  );
  const selectedPoint = filteredData.find((point) => point.capturedAt === selectedCapturedAt) ?? null;

  if (filteredData.length === 0) {
    return (
      <CabCard density="spacious">
        <CabEmptyState
          title={t("states.emptyChartTitle")}
          description={t("states.emptyChartDescription")}
        />
      </CabCard>
    );
  }

  return (
    <CabCard density="spacious">
      <CabStack gap="$4">
        <PortfolioEvolutionHeader
          range={range}
          source={viewModel.chart.source}
          coverageStatus={viewModel.chart.coverageStatus}
          isRefreshing={isRefreshing}
          onRangeChange={onRangeChange}
        />

        <PortfolioEvolutionKpiStrip summary={model.summary} locale={locale} />

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <CabCard density="default">
            <CabStack gap="$3">
              <PortfolioEvolutionLegend
                visibleSeries={visibleSeries}
                availableEventTypes={model.availableEventTypes}
                visibleEventTypes={visibleEventTypes}
                onToggleSeries={(seriesKey) =>
                  setVisibleSeries((currentState) => ({
                    ...currentState,
                    [seriesKey]: !currentState[seriesKey],
                  }))}
                onToggleEventType={(eventType) =>
                  setVisibleEventTypes((currentState) => ({
                    ...currentState,
                    [eventType]: !(currentState[eventType] ?? true),
                  }))}
              />
              <PortfolioEvolutionChart
                data={filteredData}
                range={range}
                locale={locale}
                isRefreshing={isRefreshing}
                visibleSeries={visibleSeries}
                visibleEventTypes={visibleEventTypes}
                hoveredCapturedAt={hoveredCapturedAt}
                onHoverCapturedAt={setHoveredCapturedAt}
                onOpenDetails={setSelectedCapturedAt}
              />
            </CabStack>
          </CabCard>

          <PortfolioEvolutionEventDetailsPanel
            selectedPoint={selectedPoint}
            latestEventOccurredAt={model.footer.latestEvent?.occurredAt ?? null}
            locale={locale}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <CabCard density="default">
            <CabStack gap="$2">
              <CabText variant="caption" fontSize={11}>
                {t("portfolioEvolution.footer.accumulatedRewards")}
              </CabText>
              <CabText variant="label" fontSize={16} style={{ fontVariantNumeric: "tabular-nums" }}>
                {model.footer.accumulatedRewardsUsd === null ? t("states.unavailableValue") : formatUsd(model.footer.accumulatedRewardsUsd, locale)}
              </CabText>
            </CabStack>
          </CabCard>
          <CabCard density="default">
            <CabStack gap="$2">
              <CabText variant="caption" fontSize={11}>
                {t("portfolioEvolution.footer.capitalMoved")}
              </CabText>
              <CabText variant="label" fontSize={16} style={{ fontVariantNumeric: "tabular-nums" }}>
                {model.footer.capitalMovedBetweenStatesUsd === null ? t("states.unavailableValue") : formatUsd(model.footer.capitalMovedBetweenStatesUsd, locale)}
              </CabText>
            </CabStack>
          </CabCard>
          <CabCard density="default">
            <CabStack gap="$2">
              <CabText variant="caption" fontSize={11}>
                {t("portfolioEvolution.footer.latestEvent")}
              </CabText>
              <CabText variant="label" fontSize={16} style={{ fontVariantNumeric: "tabular-nums" }}>
                {model.footer.latestEvent ? t(`portfolioEvolution.events.${model.footer.latestEvent.type === "move_to_idle" ? "moveToIdle" : model.footer.latestEvent.type}`) : t("states.unavailableValue")}
              </CabText>
              <CabText variant="caption" fontSize={11}>
                {model.footer.latestEvent ? formatRelativeTime(model.footer.latestEvent.occurredAt, locale) : t("portfolioEvolution.selectedPoint.noEvents")}
              </CabText>
            </CabStack>
          </CabCard>
          <CabCard density="default">
            <CabStack gap="$2">
              <CabText variant="caption" fontSize={11}>
                {t("portfolioEvolution.footer.maxIdle")}
              </CabText>
              <CabText variant="label" fontSize={16} style={{ fontVariantNumeric: "tabular-nums" }}>
                {model.footer.maxIdleValueUsd === null ? t("states.unavailableValue") : formatUsd(model.footer.maxIdleValueUsd, locale)}
              </CabText>
            </CabStack>
          </CabCard>
        </div>
      </CabStack>
    </CabCard>
  );
}