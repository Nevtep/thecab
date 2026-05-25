"use client";

import type { ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { CabChartFrame } from "@/design-system/charts/CabChartFrame";
import { cabColors } from "@/design-system/tokens";

export type CabDonutDatum = {
  id?: string;
  label: string;
  value: number;
  color?: string;
  opacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
};

export type CabDonutLevel = {
  data: CabDonutDatum[];
  innerRadius: number;
  outerRadius: number;
  valueFormatter?: (value: number) => string;
  paddingAngle?: number;
  cornerRadius?: number;
  onSlicePress?: (entry: CabDonutDatum, index: number) => void;
};

export type CabDonutChartProps = {
  data?: CabDonutDatum[];
  levels?: CabDonutLevel[];
  title?: string;
  subtitle?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
  centerContent?: ReactNode;
};

export function CabDonutChart({
  data,
  levels,
  title,
  subtitle,
  height,
  valueFormatter,
  centerContent,
}: CabDonutChartProps) {
  const normalizedLevels = levels && levels.length > 0
    ? levels.map((level, levelIndex) => ({
        ...level,
        data: level.data.map((entry) => ({
          ...entry,
          _cabLevelIndex: levelIndex,
        })),
      }))
    : [{
        data: (data ?? []).map((entry) => ({
          ...entry,
          _cabLevelIndex: 0,
        })),
        innerRadius: 70,
        outerRadius: 100,
        valueFormatter,
      }];

  return (
    <CabChartFrame title={title} subtitle={subtitle} height={height}>
      <div
        style={{ width: "100%", height: "100%", position: "relative" }}
        onMouseDownCapture={(event) => {
          event.preventDefault();
        }}
        onPointerDownCapture={(event) => {
          event.preventDefault();
        }}
        onPointerUpCapture={(event) => {
          const activeElement = event.currentTarget.ownerDocument.activeElement;
          if (activeElement && "blur" in activeElement && typeof activeElement.blur === "function") {
            activeElement.blur();
          }
        }}
      >
        <ResponsiveContainer>
          <PieChart
            accessibilityLayer={false}
            tabIndex={-1}
            className="cab-passive-chart-surface"
          >
            {normalizedLevels.map((level, levelIndex) => (
              <Pie
                key={`level-${levelIndex}`}
                data={level.data}
                dataKey="value"
                nameKey="label"
                innerRadius={level.innerRadius}
                outerRadius={level.outerRadius}
                paddingAngle={level.paddingAngle}
                cornerRadius={level.cornerRadius}
                onClick={(_state, index) => {
                  if (typeof index !== "number") {
                    return;
                  }

                  const entry = level.data[index];
                  if (!entry || !level.onSlicePress) {
                    return;
                  }

                  level.onSlicePress(entry, index);
                }}
              >
                {level.data.map((entry, index) => (
                  <Cell
                    key={`${entry.label}-${levelIndex}-${index}`}
                    fill={entry.color ?? (index % 2 === 0 ? cabColors.brandExtended.signalTealUi : cabColors.brand.electricBlue)}
                    fillOpacity={entry.opacity ?? 1}
                    stroke={entry.strokeColor ?? cabColors.brand.cabNight}
                    strokeWidth={entry.strokeWidth ?? 2}
                    style={{ cursor: level.onSlicePress ? "pointer" : "default" }}
                  />
                ))}
              </Pie>
            ))}
            <Tooltip
              formatter={(value, _name, item) => {
                if (typeof value !== "number") {
                  return String(value);
                }

                const payload = item?.payload as { _cabLevelIndex?: number } | undefined;
                const levelFormatter = typeof payload?._cabLevelIndex === "number"
                  ? normalizedLevels[payload._cabLevelIndex]?.valueFormatter
                  : null;

                return levelFormatter ? levelFormatter(value) : valueFormatter ? valueFormatter(value) : value;
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
          </PieChart>
        </ResponsiveContainer>
        {centerContent ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            {centerContent}
          </div>
        ) : null}
      </div>
    </CabChartFrame>
  );
}
