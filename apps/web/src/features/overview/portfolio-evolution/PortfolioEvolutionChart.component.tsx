"use client";

import {
  Area,
  Bar,
  CabChartFrame,
  CabIcon,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  cabColors,
} from "@/design-system";
import {
  portfolioEvolutionEventIcons,
  portfolioEvolutionEventMeta,
  portfolioEvolutionEventOrder,
  portfolioEvolutionSeriesMeta,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.meta";
import type { OverviewRange } from "@/features/overview/overview.types";
import type {
  PortfolioEvolutionDatum,
  PortfolioEvolutionEventType,
} from "@/features/overview/portfolio-evolution/portfolioEvolution.utils";

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
const PORTFOLIO_EVOLUTION_SYNC_ID = "portfolio-evolution";
const REWARDS_LANE_HEIGHT = 92;
const PORTFOLIO_AXIS_WIDTH = 76;
const REWARDS_AXIS_WIDTH = 56;

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
        const iconName = portfolioEvolutionEventIcons[eventType];
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
            <CabIcon
              name={iconName}
              x={(MARKER_CHIP_SIZE - MARKER_ICON_SIZE) / 2}
              y={(MARKER_CHIP_SIZE - MARKER_ICON_SIZE) / 2}
              width={MARKER_ICON_SIZE}
              height={MARKER_ICON_SIZE}
              color={color}
              size="sm"
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
  const axisLabelByCapturedAt = new Map(data.map((point) => [point.capturedAt, point.axisLabel] as const));
  const portfolioValues = data.flatMap((point) => [point.totalValueUsd, point.deployedValueUsd, point.idleValueUsd])
    .filter((value): value is number => value !== null);
  const rewardBucketValues = data.map((point) => point.rewardValueUsd).filter((value): value is number => value !== null);
  const cumulativeRewardValues = data.map((point) => point.cumulativeRewardValueUsd).filter((value): value is number => value !== null);
  const portfolioMin = portfolioValues.length > 0 ? Math.min(...portfolioValues) : 0;
  const portfolioMax = portfolioValues.length > 0 ? Math.max(...portfolioValues) : 0;
  const portfolioSpan = Math.max(portfolioMax - portfolioMin, portfolioMax || 0, 1);
  const rewardBucketMax = rewardBucketValues.length > 0 ? Math.max(...rewardBucketValues) : 0;
  const cumulativeRewardsMax = cumulativeRewardValues.length > 0 ? Math.max(...cumulativeRewardValues) : 0;
  const markerBandValueUsd = portfolioMin + portfolioSpan * 0.08;
  const showRewardsLane = visibleSeries.rewards;
  const filteredMarkerData = data.filter((point) =>
    point.events.some((event) => visibleEventTypes[event.type] ?? true),
  );

  return (
    <CabChartFrame
      ariaLabel="Portfolio evolution analytics chart"
      summary="Portfolio evolution across the selected period"
      loadingLabel={isRefreshing ? `Refreshing ${range}` : undefined}
      height={showRewardsLane ? 470 : 380}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          outline: "none",
          userSelect: "none",
          display: "grid",
          gridTemplateRows: showRewardsLane ? `minmax(0, 1fr) ${REWARDS_LANE_HEIGHT}px` : "minmax(0, 1fr)",
          gap: showRewardsLane ? 12 : 0,
        }}
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
        <div style={{ minHeight: 0 }}>
          <ResponsiveContainer>
            <ComposedChart
              accessibilityLayer={false}
              syncId={PORTFOLIO_EVOLUTION_SYNC_ID}
              data={data}
              className="cab-passive-chart-surface"
              margin={{ top: 12, right: 12, bottom: showRewardsLane ? 0 : 8, left: 0 }}
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
              </defs>
              <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 5" vertical={false} />
              <XAxis
                dataKey="capturedAt"
                hide={showRewardsLane}
                scale="point"
                padding={{ left: 0, right: 0 }}
                stroke={cabColors.text.muted}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => typeof value === "string" ? (axisLabelByCapturedAt.get(value) ?? "") : ""}
                minTickGap={24}
              />
              <YAxis
                yAxisId="portfolio"
                stroke={cabColors.text.muted}
                tick={{ fontSize: 12 }}
                width={PORTFOLIO_AXIS_WIDTH}
                tickFormatter={(value) => formatCompactAxisNumber(value, locale)}
                domain={[0, portfolioMax > 0 ? portfolioMax * 1.06 : 10]}
              />
              <YAxis
                yAxisId="portfolio-alignment"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={false}
                width={REWARDS_AXIS_WIDTH}
                domain={[0, 1]}
                stroke="transparent"
              />
              <Tooltip
                wrapperStyle={{ pointerEvents: "none", outline: "none" }}
                cursor={{ stroke: cabColors.brandExtended.signalTealUi, strokeOpacity: 0.35, strokeWidth: 1 }}
                content={<PortfolioEvolutionTooltip locale={locale} range={range} />}
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {showRewardsLane ? (
          <div
            style={{
              minHeight: 0,
              borderTop: `1px solid ${cabColors.surface.border}`,
              paddingTop: 6,
            }}
          >
            <ResponsiveContainer>
              <ComposedChart
                accessibilityLayer={false}
                syncId={PORTFOLIO_EVOLUTION_SYNC_ID}
                data={data}
                barCategoryGap={18}
                className="cab-passive-chart-surface"
                margin={{ top: 6, right: 12, bottom: 0, left: 0 }}
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
                  <linearGradient id="portfolio-evolution-reward-bars" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cabColors.dataViz.orange} stopOpacity={0.84} />
                    <stop offset="100%" stopColor={cabColors.dataViz.orange} stopOpacity={0.22} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="2 6" vertical={false} />
                <XAxis
                  dataKey="capturedAt"
                  scale="point"
                  padding={{ left: 0, right: 0 }}
                  stroke={cabColors.text.muted}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => typeof value === "string" ? (axisLabelByCapturedAt.get(value) ?? "") : ""}
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="rewardBuckets"
                  stroke={cabColors.dataViz.orange}
                  tick={{ fontSize: 11, fill: cabColors.dataViz.orange }}
                  width={PORTFOLIO_AXIS_WIDTH}
                  tickFormatter={(value) => formatCompactAxisNumber(value, locale)}
                  domain={[0, rewardBucketMax > 0 ? rewardBucketMax * 1.18 : 10]}
                />
                <YAxis
                  yAxisId="rewardCumulative"
                  orientation="right"
                  stroke={portfolioEvolutionSeriesMeta.rewards.color}
                  tick={{ fontSize: 11, fill: portfolioEvolutionSeriesMeta.rewards.color }}
                  width={REWARDS_AXIS_WIDTH}
                  tickFormatter={(value) => formatCompactAxisNumber(value, locale)}
                  domain={[0, cumulativeRewardsMax > 0 ? cumulativeRewardsMax * 1.08 : 10]}
                />
                <Tooltip wrapperStyle={{ display: "none" }} cursor={false} content={<PortfolioEvolutionTooltip locale={locale} range={range} />} />

                {hoveredCapturedAt ? (
                  <ReferenceLine
                    x={hoveredCapturedAt}
                    stroke={portfolioEvolutionSeriesMeta.rewards.color}
                    strokeOpacity={0.28}
                  />
                ) : null}

                <Bar
                  yAxisId="rewardBuckets"
                  dataKey="rewardValueUsd"
                  barSize={10}
                  fill="url(#portfolio-evolution-reward-bars)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="rewardCumulative"
                  type="monotone"
                  dataKey="cumulativeRewardValueUsd"
                  stroke={portfolioEvolutionSeriesMeta.rewards.color}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: portfolioEvolutionSeriesMeta.rewards.color }}
                  connectNulls
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </CabChartFrame>
  );
}