"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

export type CabPoolValueDatum = {
  timestamp: string;
  deployedValueUsd: number;
  residualValueUsd: number;
  rewardValueUsd: number;
  cumulativeRewardsUsd: number;
};

export type CabPoolValueChartProps = {
  data: CabPoolValueDatum[];
  title?: string;
};

export function CabPoolValueChart({ data, title }: CabPoolValueChartProps) {
  const portfolioValues = data.flatMap((point) => [point.deployedValueUsd, point.residualValueUsd])
    .filter((value) => Number.isFinite(value));
  const rewardsValues = data.map((point) => point.cumulativeRewardsUsd).filter((value) => Number.isFinite(value));
  const portfolioMax = portfolioValues.length > 0 ? Math.max(...portfolioValues) : 0;
  const rewardsMax = rewardsValues.length > 0 ? Math.max(...rewardsValues) : 0;

  return (
    <CabChartFrame title={title} ariaLabel={title} summary="Pool value and rewards across the selected period">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 2 }}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" stroke={cabColors.text.muted} tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="value"
            stroke={cabColors.text.muted}
            tick={{ fontSize: 12 }}
            width={72}
            domain={[0, portfolioMax > 0 ? portfolioMax * 1.08 : 10]}
          />
          <YAxis
            yAxisId="rewards"
            orientation="right"
            stroke={cabColors.dataViz.orange}
            tick={{ fontSize: 12 }}
            width={72}
            domain={[0, rewardsMax > 0 ? rewardsMax * 1.08 : 10]}
          />
          <Tooltip
            cursor={{
              stroke: cabColors.brandExtended.signalTealUi,
              strokeOpacity: 0.3,
              strokeWidth: 1,
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
          <Area
            yAxisId="value"
            dataKey="deployedValueUsd"
            name="Deployed"
            type="monotone"
            stroke={cabColors.brandExtended.signalTealRaw}
            fill={cabColors.brandExtended.signalTealGlow}
            isAnimationActive={false}
          />
          <Area
            yAxisId="value"
            dataKey="residualValueUsd"
            name="Residual"
            type="monotone"
            stroke={cabColors.brand.electricBlue}
            fill={`${cabColors.brand.electricBlue}26`}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rewards"
            dataKey="cumulativeRewardsUsd"
            name="Rewards"
            type="monotone"
            stroke={cabColors.dataViz.orange}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
