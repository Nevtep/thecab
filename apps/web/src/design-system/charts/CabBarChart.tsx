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
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 2 }} barCategoryGap={18}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} tick={{ fontSize: 12 }} />
          <YAxis stroke={cabColors.text.muted} tick={{ fontSize: 12 }} width={46} />
          <Tooltip
            cursor={{ fill: "rgba(46, 197, 201, 0.14)" }}
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
            <Bar
              key={item.key}
              dataKey={item.key as never}
              fill={item.color ?? (index === 0 ? cabColors.brandExtended.signalTealUi : cabColors.brand.electricBlue)}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
