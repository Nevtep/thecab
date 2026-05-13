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
                fill={entry.color ?? (index % 2 === 0 ? cabColors.brand.signalTeal : cabColors.brand.electricBlue)}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
