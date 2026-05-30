"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "@/design-system/charts/CabChartPrimitives";
import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

export type CabRewardsTimelineDatum = {
  timestamp: string;
  rewardValueUsd: number;
  rewardReturnPct: number | null;
  rewardEventCount: number;
};

export type CabRewardsTimelineChartProps = {
  data: CabRewardsTimelineDatum[];
  title?: string;
  subtitle?: string;
  notice?: string;
  valueFormatter?: (value: number) => string;
  percentFormatter?: (value: number) => string;
  countFormatter?: (value: number) => string;
};

export function CabRewardsTimelineChart({
  data,
  title,
  subtitle,
  notice,
  valueFormatter,
  percentFormatter,
  countFormatter,
}: CabRewardsTimelineChartProps) {
  const gradientId = "cab-rewards-timeline-value";

  return (
    <CabChartFrame
      title={title}
      subtitle={subtitle}
      notice={notice}
      height={320}
      ariaLabel={title}
      summary={subtitle}
    >
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} barCategoryGap={data.length > 90 ? 2 : 8}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cabColors.brand.signalTeal} stopOpacity={0.98} />
              <stop offset="58%" stopColor={cabColors.brandExtended.signalTealUi} stopOpacity={0.72} />
              <stop offset="100%" stopColor={cabColors.brand.electricBlue} stopOpacity={0.2} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke={cabColors.text.muted}
            tick={{ fontSize: 11 }}
            minTickGap={28}
          />
          <YAxis
            yAxisId="value"
            stroke={cabColors.text.muted}
            tick={{ fontSize: 11 }}
            width={56}
            tickFormatter={(value) => valueFormatter ? valueFormatter(Number(value)) : String(value)}
          />
          <YAxis
            yAxisId="return"
            orientation="right"
            stroke={cabColors.brand.cabGold}
            tick={{ fontSize: 11 }}
            width={44}
            tickFormatter={(value) => percentFormatter ? percentFormatter(Number(value)) : String(value)}
          />
          <Tooltip
            cursor={{ fill: "rgba(46, 197, 201, 0.14)" }}
            formatter={(value, name) => {
              const numericValue = Number(value);
              if (name === "rewardReturnPct") {
                return [percentFormatter ? percentFormatter(numericValue) : numericValue, "Return"];
              }
              if (name === "rewardEventCount") {
                return [countFormatter ? countFormatter(numericValue) : numericValue, "Events"];
              }
              return [valueFormatter ? valueFormatter(numericValue) : numericValue, "Rewards"];
            }}
            contentStyle={{
              backgroundColor: cabColors.surface.elevatedSurface,
              border: `1px solid ${cabColors.surface.border}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            }}
            labelStyle={{ color: cabColors.text.secondary, fontSize: 12, fontWeight: 500 }}
            itemStyle={{ color: cabColors.text.primary, fontSize: 13 }}
          />
          <Bar
            yAxisId="value"
            dataKey="rewardValueUsd"
            fill={`url(#${gradientId})`}
            radius={[4, 4, 0, 0]}
            minPointSize={2}
            isAnimationActive={false}
          />
          <Line
            yAxisId="return"
            type="monotone"
            dataKey="rewardReturnPct"
            stroke={cabColors.brand.cabGold}
            strokeWidth={2.4}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="value"
            type="monotone"
            dataKey="rewardEventCount"
            stroke={cabColors.brand.electricBlue}
            strokeWidth={1.8}
            dot={false}
            opacity={0.62}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
