"use client";

import type { ComponentType, SVGProps } from "react";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";
import {
  portfolioEvolutionEventIcons,
  portfolioEvolutionEventMeta,
  portfolioEvolutionEventOrder,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
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

function resolveCapturedAtFromChartState(
  state: {
    activeLabel?: unknown;
    activePayload?: Array<{ payload?: PortfolioEvolutionDatum }>;
    activeTooltipIndex?: number | string | null;
  } | null | undefined,
  data: PortfolioEvolutionDatum[],
) {
  if (typeof state?.activeLabel === "string") {
    return state.activeLabel;
  }

  const payloadCapturedAt = state?.activePayload?.[0]?.payload?.capturedAt;
  if (typeof payloadCapturedAt === "string") {
    return payloadCapturedAt;
  }

  if (typeof state?.activeTooltipIndex === "number") {
    return data[state.activeTooltipIndex]?.capturedAt ?? null;
  }

  if (typeof state?.activeTooltipIndex === "string") {
    const parsedIndex = Number(state.activeTooltipIndex);
    if (Number.isFinite(parsedIndex)) {
      return data[parsedIndex]?.capturedAt ?? null;
    }
  }

  return null;
}

type PortfolioEvolutionChartProps = {
  data: PortfolioEvolutionDatum[];
  range: OverviewRange;
  locale: string;
  isRefreshing: boolean;
  visibleSeries: Record<PortfolioEvolutionSeriesKey, boolean>;
  visibleEventTypes: Partial<Record<PortfolioEvolutionEventType, boolean>>;
  hoveredCapturedAt: string | null;
  onHoverCapturedAt: (capturedAt: string | null) => void;
  onOpenDetails: (capturedAt: string) => void;
};

const MARKER_ICON_SIZE = 12;
const MARKER_CHIP_SIZE = 18;
const MARKER_CHIP_RADIUS = 6;
const MARKER_STACK_GAP = 5;
const MARKER_STACK_TOP_OFFSET_Y = 4;
const MARKER_CONNECTOR_GAP = 4;
const MARKER_CONNECTOR_BOTTOM_OFFSET = 4;

function getUniqueBucketEventTypes(events: PortfolioEvolutionDatum["events"]) {
  const presentTypes = new Set(events.map((event) => event.type));

  return portfolioEvolutionEventOrder.filter((type) => presentTypes.has(type));
}

function EventStackMarker({
  cx,
  cy,
  eventTypes,
}: {
  cx?: number;
  cy?: number;
  eventTypes: PortfolioEvolutionEventType[];
}) {
  if (typeof cx !== "number" || typeof cy !== "number" || eventTypes.length === 0) {
    return null;
  }

  const stackHeight = eventTypes.length * MARKER_CHIP_SIZE + Math.max(0, eventTypes.length - 1) * MARKER_STACK_GAP;
  const primaryColor = portfolioEvolutionEventMeta[eventTypes[0]].color;
  const stackOriginY = cy - stackHeight - MARKER_STACK_TOP_OFFSET_Y;
  const connectorStartY = stackOriginY + stackHeight + MARKER_CONNECTOR_GAP;
  const connectorEndY = Math.max(connectorStartY + 8, cy - MARKER_CONNECTOR_BOTTOM_OFFSET);

  return (
    <g>
      <line
        x1={cx}
        y1={connectorStartY}
        x2={cx}
        y2={connectorEndY}
        stroke={primaryColor}
        strokeOpacity={0.75}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {eventTypes.map((eventType, index) => {
        const color = portfolioEvolutionEventMeta[eventType].color;
        const Icon = portfolioEvolutionEventIcons[eventType] as ComponentType<SVGProps<SVGSVGElement>>;
        const chipY = stackOriginY + index * (MARKER_CHIP_SIZE + MARKER_STACK_GAP);

        return (
          <g key={eventType} transform={`translate(${cx - MARKER_CHIP_SIZE / 2}, ${chipY})`}>
            <rect
              width={MARKER_CHIP_SIZE}
              height={MARKER_CHIP_SIZE}
              rx={MARKER_CHIP_RADIUS}
              fill={`${color}18`}
              stroke={`${color}88`}
            />
            <Icon
              x={(MARKER_CHIP_SIZE - MARKER_ICON_SIZE) / 2}
              y={(MARKER_CHIP_SIZE - MARKER_ICON_SIZE) / 2}
              width={MARKER_ICON_SIZE}
              height={MARKER_ICON_SIZE}
              color={color}
              strokeWidth={2}
            />
          </g>
        );
      })}
    </g>
  );
}

export function PortfolioEvolutionChart({
  data,
  range,
  locale,
  isRefreshing,
  visibleSeries,
  visibleEventTypes,
  hoveredCapturedAt,
  onHoverCapturedAt,
  onOpenDetails,
}: PortfolioEvolutionChartProps) {
  const portfolioValues = data.flatMap((point) => [point.totalValueUsd, point.deployedValueUsd, point.idleValueUsd])
    .filter((value): value is number => value !== null);
  const rewardValues = data.flatMap((point) => [point.rewardValueUsd, point.cumulativeRewardValueUsd])
    .filter((value): value is number => value !== null);
  const portfolioMin = portfolioValues.length > 0 ? Math.min(...portfolioValues) : 0;
  const portfolioMax = portfolioValues.length > 0 ? Math.max(...portfolioValues) : 0;
  const portfolioSpan = Math.max(portfolioMax - portfolioMin, portfolioMax || 0, 1);
  const rewardsMax = rewardValues.length > 0 ? Math.max(...rewardValues) : 0;
  const markerBandValueUsd = portfolioMin + portfolioSpan * 0.08;
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
      <div
        style={{ width: "100%", height: "100%", outline: "none", userSelect: "none" }}
        onMouseDownCapture={(event) => {
          event.preventDefault();
        }}
        onPointerDownCapture={(event) => {
          event.preventDefault();
        }}
        onMouseUpCapture={(event) => {
          const activeElement = event.currentTarget.ownerDocument.activeElement;
          if (activeElement instanceof HTMLElement) {
            activeElement.blur();
          }
        }}
      >
        <ResponsiveContainer>
        <ComposedChart
          accessibilityLayer={false}
          data={data}
          className="cab-passive-chart-surface"
          margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
          onMouseMove={(state) => {
            onHoverCapturedAt(resolveCapturedAtFromChartState(state, data));
          }}
          onMouseLeave={() => onHoverCapturedAt(null)}
          onClick={(state) => {
            const capturedAt = resolveCapturedAtFromChartState(state, data);
            if (capturedAt) {
              onOpenDetails(capturedAt);
            }
          }}
        >
          <defs>
            <linearGradient id="portfolio-evolution-deployed-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cabColors.brand.cabGold} stopOpacity={0.26} />
              <stop offset="55%" stopColor={cabColors.brand.cabGold} stopOpacity={0.12} />
              <stop offset="100%" stopColor={cabColors.brand.cabGold} stopOpacity={0.03} />
            </linearGradient>
            <linearGradient id="portfolio-evolution-idle-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cabColors.brand.electricBlue} stopOpacity={0.22} />
              <stop offset="55%" stopColor={cabColors.brand.electricBlue} stopOpacity={0.1} />
              <stop offset="100%" stopColor={cabColors.brand.electricBlue} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="portfolio-evolution-reward-bars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cabColors.brand.cabGold} stopOpacity={0.28} />
              <stop offset="100%" stopColor={cabColors.brand.cabGold} stopOpacity={0.06} />
            </linearGradient>
          </defs>
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
            wrapperStyle={{ pointerEvents: "none", outline: "none" }}
            cursor={{ stroke: cabColors.brandExtended.signalTealUi, strokeOpacity: 0.35, strokeWidth: 1 }}
            content={<PortfolioEvolutionTooltip locale={locale} />}
          />

          {hoveredCapturedAt ? (
            <ReferenceLine x={hoveredCapturedAt} stroke={cabColors.brandExtended.signalTealUi} strokeOpacity={0.3} />
          ) : null}

          {filteredMarkerData.map((point) => {
            const uniqueEventTypes = getUniqueBucketEventTypes(
              point.events.filter((event) => visibleEventTypes[event.type] ?? true),
            );
            const primaryEventType = uniqueEventTypes[0] ?? null;

            if (!primaryEventType) {
              return null;
            }

            return (
              <g key={`marker-${point.capturedAt}`}>
                <ReferenceLine
                  x={point.capturedAt}
                  stroke={portfolioEvolutionEventMeta[primaryEventType].color}
                  strokeOpacity={0.12}
                  strokeDasharray="3 8"
                />
                <ReferenceDot
                  x={point.capturedAt}
                  y={markerBandValueUsd}
                  yAxisId="portfolio"
                  r={0}
                  fill="transparent"
                  stroke="transparent"
                  shape={<EventStackMarker eventTypes={uniqueEventTypes} />}
                  ifOverflow="extendDomain"
                  onClick={() => onOpenDetails(point.capturedAt)}
                />
              </g>
            );
          })}

          {visibleSeries.rewards ? (
            <Bar
              yAxisId="rewards"
              dataKey="rewardValueUsd"
              barSize={10}
              fill="url(#portfolio-evolution-reward-bars)"
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
              fill="url(#portfolio-evolution-deployed-fill)"
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
              fill="url(#portfolio-evolution-idle-fill)"
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
      </div>
    </CabChartFrame>
  );
}