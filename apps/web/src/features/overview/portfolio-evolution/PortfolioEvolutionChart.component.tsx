"use client";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";
import { portfolioEvolutionEventMeta } from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { OverviewRange } from "@/features/overview/overview.types";
import type {
  PortfolioEvolutionDatum,
  PortfolioEvolutionEventType,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCompactAxisNumber } from "@/i18n/formatters";
import { PortfolioEvolutionTooltip } from "@/features/overview/portfolio-evolution/PortfolioEvolutionTooltip.component";
import type { PortfolioEvolutionSeriesKey } from "@/features/overview/portfolio-evolution/PortfolioEvolutionLegend.component";

type PortfolioEvolutionChartProps = {
  data: PortfolioEvolutionDatum[];
  range: OverviewRange;
  locale: string;
  isRefreshing: boolean;
  visibleSeries: Record<PortfolioEvolutionSeriesKey, boolean>;
  visibleEventTypes: Partial<Record<PortfolioEvolutionEventType, boolean>>;
  selectedCapturedAt: string | null;
  onSelectCapturedAt: (capturedAt: string) => void;
};

export function PortfolioEvolutionChart({
  data,
  range,
  locale,
  isRefreshing,
  visibleSeries,
  visibleEventTypes,
  selectedCapturedAt,
  onSelectCapturedAt,
}: PortfolioEvolutionChartProps) {
  const portfolioValues = data.flatMap((point) => [point.totalValueUsd, point.deployedValueUsd, point.idleValueUsd])
    .filter((value): value is number => value !== null);
  const rewardValues = data.flatMap((point) => [point.rewardValueUsd, point.cumulativeRewardValueUsd])
    .filter((value): value is number => value !== null);
  const portfolioMin = portfolioValues.length > 0 ? Math.min(...portfolioValues) : 0;
  const portfolioMax = portfolioValues.length > 0 ? Math.max(...portfolioValues) : 0;
  const rewardsMax = rewardValues.length > 0 ? Math.max(...rewardValues) : 0;
  const filteredMarkerData = data.filter((point) =>
    point.events.some((event) => visibleEventTypes[event.type] ?? true),
  );

  return (
    <CabChartFrame
      ariaLabel="Portfolio evolution analytics chart"
      summary="Portfolio evolution across the selected period"
      loadingLabel={isRefreshing ? `Refreshing ${range}` : undefined}
      height={380}
    >
      <ResponsiveContainer>
        <ComposedChart
          accessibilityLayer={false}
          data={data}
          margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
          onMouseMove={(state) => {
            const nextPoint = typeof state.activeTooltipIndex === "number"
              ? data[state.activeTooltipIndex]
              : undefined;
            if (nextPoint?.capturedAt) {
              onSelectCapturedAt(nextPoint.capturedAt);
            }
          }}
        >
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 5" vertical={false} />
          <XAxis
            dataKey="capturedAt"
            stroke={cabColors.text.muted}
            tick={{ fontSize: 12 }}
            tickFormatter={(_, index) => data[index]?.axisLabel ?? ""}
            minTickGap={24}
          />
          <YAxis
            yAxisId="portfolio"
            stroke={cabColors.text.muted}
            tick={{ fontSize: 12 }}
            width={76}
            tickFormatter={(value) => formatCompactAxisNumber(value, locale)}
            domain={[
              portfolioMin > 0 ? portfolioMin * 0.96 : 0,
              portfolioMax > 0 ? portfolioMax * 1.06 : 10,
            ]}
          />
          <YAxis
            yAxisId="rewards"
            orientation="right"
            hide
            domain={[0, rewardsMax > 0 ? rewardsMax * 1.12 : 10]}
          />
          <Tooltip
            cursor={{ stroke: cabColors.brandExtended.signalTealUi, strokeOpacity: 0.35, strokeWidth: 1 }}
            content={<PortfolioEvolutionTooltip locale={locale} />}
          />

          {selectedCapturedAt ? (
            <ReferenceLine x={selectedCapturedAt} stroke={cabColors.brandExtended.signalTealUi} strokeOpacity={0.3} />
          ) : null}

          {filteredMarkerData.map((point) => {
            const firstEvent = point.events.find((event) => visibleEventTypes[event.type] ?? true);
            if (!firstEvent || point.markerAnchorValueUsd === null) {
              return null;
            }

            return (
              <g key={`marker-${point.capturedAt}`}>
                <ReferenceLine
                  x={point.capturedAt}
                  stroke={portfolioEvolutionEventMeta[firstEvent.type].color}
                  strokeOpacity={0.24}
                  strokeDasharray="2 6"
                />
                <ReferenceDot
                  x={point.capturedAt}
                  y={point.markerAnchorValueUsd}
                  yAxisId="portfolio"
                  r={4}
                  fill={portfolioEvolutionEventMeta[firstEvent.type].color}
                  stroke={portfolioEvolutionEventMeta[firstEvent.type].color}
                  ifOverflow="extendDomain"
                  onClick={() => onSelectCapturedAt(point.capturedAt)}
                />
              </g>
            );
          })}

          {visibleSeries.rewards ? (
            <Bar
              yAxisId="rewards"
              dataKey="rewardValueUsd"
              barSize={10}
              fill="rgba(242, 193, 78, 0.18)"
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ) : null}
          {visibleSeries.deployed ? (
            <Area
              yAxisId="portfolio"
              type="monotone"
              dataKey="deployedValueUsd"
              stroke={cabColors.brand.cabGold}
              fill="rgba(242, 193, 78, 0.14)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ) : null}
          {visibleSeries.idle ? (
            <Area
              yAxisId="portfolio"
              type="monotone"
              dataKey="idleValueUsd"
              stroke={cabColors.brand.electricBlue}
              fill="rgba(59, 130, 246, 0.12)"
              strokeWidth={2}
              isAnimationActive={false}
            />
          ) : null}
          {visibleSeries.total ? (
            <Line
              yAxisId="portfolio"
              type="monotone"
              dataKey="totalValueUsd"
              stroke={cabColors.brand.signalTeal}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          {visibleSeries.rewards ? (
            <Line
              yAxisId="rewards"
              type="monotone"
              dataKey="cumulativeRewardValueUsd"
              stroke={cabColors.brand.cabGold}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}