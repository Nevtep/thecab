"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

export type CabDonutDatum = { label: string; value: number; color?: string };

export type CabDonutChartProps = {
  data: CabDonutDatum[];
  title?: string;
  subtitle?: string;
  height?: number;
};

export function CabDonutChart({ data, title, subtitle, height }: CabDonutChartProps) {
  return (
    <CabChartFrame title={title} subtitle={subtitle} height={height}>
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={70} outerRadius={100}>
            {data.map((entry, index) => (
              <Cell
                key={`${entry.label}-${index}`}
                fill={entry.color ?? (index % 2 === 0 ? cabColors.brandExtended.signalTealUi : cabColors.brand.electricBlue)}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: cabColors.surface.elevatedSurface,
              border: `1px solid ${cabColors.surface.border}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
            }}
            labelStyle={{ color: cabColors.text.secondary, fontSize: 12, fontWeight: 500 }}
            itemStyle={{ color: cabColors.text.primary, fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
