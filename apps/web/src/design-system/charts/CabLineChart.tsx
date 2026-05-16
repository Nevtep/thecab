"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

export type CabChartSeries<T extends Record<string, unknown>> = {
  key: keyof T & string;
  label: string;
  color?: string;
};

export type CabLineChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: string;
  series: CabChartSeries<T>[];
  title?: string;
  subtitle?: string;
  height?: number;
  ariaLabel?: string;
  summary?: string;
};

export function CabLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  title,
  subtitle,
  height,
  ariaLabel,
  summary,
}: CabLineChartProps<T>) {
  return (
    <CabChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      ariaLabel={ariaLabel ?? title}
      summary={summary ?? subtitle}
    >
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 2 }}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} tick={{ fontSize: 12 }} />
          <YAxis stroke={cabColors.text.muted} tick={{ fontSize: 12 }} width={46} />
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
          {series.map((item, index) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key as never}
              stroke={item.color ?? (index === 0 ? cabColors.brand.signalTeal : cabColors.brand.electricBlue)}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
