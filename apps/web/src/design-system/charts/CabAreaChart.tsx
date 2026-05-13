"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

type CabAreaSeries<T extends Record<string, unknown>> = {
  key: keyof T & string;
  label: string;
  stroke?: string;
  fill?: string;
};

export type CabAreaChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: string;
  series: CabAreaSeries<T>[];
  title?: string;
  subtitle?: string;
  height?: number;
};

export function CabAreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  title,
  subtitle,
  height,
}: CabAreaChartProps<T>) {
  return (
    <CabChartFrame title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} />
          <YAxis stroke={cabColors.text.muted} />
          <Tooltip />
          {series.map((item, index) => {
            const stroke = item.stroke ?? (index === 0 ? cabColors.brand.signalTeal : cabColors.brand.electricBlue);
            return (
              <Area
                key={item.key}
                dataKey={item.key as never}
                type="monotone"
                stroke={stroke}
                fill={item.fill ?? `${stroke}33`}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
