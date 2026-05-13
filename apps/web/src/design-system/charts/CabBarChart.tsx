"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

type CabBarSeries<T extends Record<string, unknown>> = {
  key: keyof T & string;
  label: string;
  color?: string;
};

export type CabBarChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: string;
  series: CabBarSeries<T>[];
  title?: string;
  subtitle?: string;
  height?: number;
};

export function CabBarChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  title,
  subtitle,
  height,
}: CabBarChartProps<T>) {
  return (
    <CabChartFrame title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} />
          <YAxis stroke={cabColors.text.muted} />
          <Tooltip />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key as never}
              fill={item.color ?? (index === 0 ? cabColors.brand.signalTeal : cabColors.brand.electricBlue)}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
