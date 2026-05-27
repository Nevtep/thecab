"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { cabColors } from "@/design-system/tokens";

export type CabGaugeChartProps = {
  value: number;
  max: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

export function CabGaugeChart({
  value,
  max,
  height = 88,
  color = cabColors.brandExtended.signalTealUi,
  trackColor = "rgba(148, 163, 184, 0.18)",
}: CabGaugeChartProps) {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 1;
  const clampedValue = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const remainder = Math.max(safeMax - clampedValue, 0);
  const data = [
    { id: "value", value: clampedValue, color },
    { id: "remainder", value: remainder, color: trackColor },
  ];

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="68%"
            outerRadius="100%"
            stroke="none"
            cornerRadius={10}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.id} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}