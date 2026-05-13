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
};

export function CabLineChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  title,
  subtitle,
  height,
}: CabLineChartProps<T>) {
  return (
    <CabChartFrame title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} />
          <YAxis stroke={cabColors.text.muted} />
          <Tooltip />
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
