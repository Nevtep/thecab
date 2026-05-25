"use client";

import { CabCard, CabEmptyState, CabStack } from "@/design-system";
import { cabColors } from "@/design-system/tokens";
import { OverviewImpactMetricCard } from "@/features/overview/OverviewImpactMetricCard";
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
  portfolioEvolutionEventIcons,
  portfolioEvolutionEventMeta,
  portfolioEvolutionSeriesMeta,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import {
  PortfolioEvolutionLegend,
  type PortfolioEvolutionSeriesKey,
} from "@/features/overview/portfolio-evolution/PortfolioEvolutionLegend.component";
import {
  buildPortfolioEvolutionModel,
  type PortfolioEvolutionModel,
  type PortfolioEvolutionEventType,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import { formatRelativeTime, formatUsd } from "@/i18n/formatters";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type PortfolioEvolutionSectionProps = {
  viewModel: OverviewViewModel;
  model?: PortfolioEvolutionModel | null;
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

function getPortfolioEvolutionEventLabelKeySuffix(eventType: PortfolioEvolutionEventType) {
  if (eventType === "move_to_idle") {
    return "moveToIdle";
  }

  if (eventType === "cash_out") {
    return "cashOut";
  }

  return eventType;
}

export function PortfolioEvolutionSection({
  viewModel,
  model,
  activity,
  range,
  locale,
  isRefreshing,
  onRangeChange,
}: PortfolioEvolutionSectionProps) {
  const { t } = useTranslation(["overview"]);
  const computedModel = useMemo(
    () => buildPortfolioEvolutionModel({
      viewModel,
      activity,
      range,
      locale,
    }),
    [activity, locale, range, viewModel],
  );
  const resolvedModel = model ?? computedModel;
  const [visibleSeries, setVisibleSeries] = useState(defaultVisibleSeries);
  const [visibleEventTypes, setVisibleEventTypes] = useState<Partial<Record<PortfolioEvolutionEventType, boolean>>>({});
  const [hoveredCapturedAt, setHoveredCapturedAt] = useState<string | null>(null);
  const [selectedCapturedAt, setSelectedCapturedAt] = useState<string | null>(null);

  const filteredData = useMemo(
    () => resolvedModel.data.map((point) => ({
      ...point,
      events: point.events.filter((event) => visibleEventTypes[event.type] ?? true),
    })),
    [resolvedModel.data, visibleEventTypes],
  );
  const capitalMovedSeries = useMemo(
    () => filteredData.map((point, index) => {
      if (index === 0) {
        return 0;
      }

      const previous = filteredData[index - 1];
      if (
        previous?.deployedValueUsd === null ||
        previous?.idleValueUsd === null ||
        point.deployedValueUsd === null ||
        point.idleValueUsd === null
      ) {
        return 0;
      }

      const deployedDelta = point.deployedValueUsd - previous.deployedValueUsd;
      const idleDelta = point.idleValueUsd - previous.idleValueUsd;
      if (deployedDelta === 0 || idleDelta === 0 || Math.sign(deployedDelta) === Math.sign(idleDelta)) {
        return 0;
      }

      return Math.min(Math.abs(deployedDelta), Math.abs(idleDelta));
    }),
    [filteredData],
  );
  const eventDensitySeries = useMemo(
    () => filteredData.map((point) => point.events.length),
    [filteredData],
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

        <PortfolioEvolutionKpiStrip summary={resolvedModel.summary} locale={locale} />

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
                availableEventTypes={resolvedModel.availableEventTypes}
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
            latestEventOccurredAt={resolvedModel.footer.latestEvent?.occurredAt ?? null}
            chainId={viewModel.chainId}
            locale={locale}
            range={range}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          <OverviewImpactMetricCard
            label={t("portfolioEvolution.footer.accumulatedRewards")}
            value={resolvedModel.footer.accumulatedRewardsUsd === null ? t("states.unavailableValue") : formatUsd(resolvedModel.footer.accumulatedRewardsUsd, locale)}
            iconName="rewards"
            accentColor={portfolioEvolutionSeriesMeta.rewards.color}
            series={filteredData.map((point) => point.cumulativeRewardValueUsd)}
            size="compact"
          />
          <OverviewImpactMetricCard
            label={t("portfolioEvolution.footer.capitalMoved")}
            value={resolvedModel.footer.capitalMovedBetweenStatesUsd === null ? t("states.unavailableValue") : formatUsd(resolvedModel.footer.capitalMovedBetweenStatesUsd, locale)}
            iconName="refreshCcw"
            accentColor={cabColors.semantic.info}
            series={capitalMovedSeries}
            size="compact"
          />
          <OverviewImpactMetricCard
            label={t("portfolioEvolution.footer.latestEvent")}
            value={resolvedModel.footer.latestEvent ? t(`portfolioEvolution.events.${getPortfolioEvolutionEventLabelKeySuffix(resolvedModel.footer.latestEvent.type)}`) : t("states.unavailableValue")}
            iconName={resolvedModel.footer.latestEvent ? portfolioEvolutionEventIcons[resolvedModel.footer.latestEvent.type] : "activity"}
            accentColor={resolvedModel.footer.latestEvent ? portfolioEvolutionEventMeta[resolvedModel.footer.latestEvent.type].color : cabColors.text.muted}
            series={eventDensitySeries}
            meta={resolvedModel.footer.latestEvent ? formatRelativeTime(resolvedModel.footer.latestEvent.occurredAt, locale) : t("portfolioEvolution.footer.noEvents")}
            size="compact"
          />
          <OverviewImpactMetricCard
            label={t("portfolioEvolution.footer.maxIdle")}
            value={resolvedModel.footer.maxIdleValueUsd === null ? t("states.unavailableValue") : formatUsd(resolvedModel.footer.maxIdleValueUsd, locale)}
            iconName="wallet"
            accentColor={portfolioEvolutionSeriesMeta.idle.color}
            series={filteredData.map((point) => point.idleValueUsd)}
            size="compact"
          />
        </div>
      </CabStack>
    </CabCard>
  );
}