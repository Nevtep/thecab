"use client";

import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
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

type CabAreaChartMarker<T extends Record<string, unknown>> = {
  valueKey: keyof T & string;
  yKey: keyof T & string;
  color?: string;
  radius?: number;
};

export type CabAreaChartProps<T extends Record<string, unknown>> = {
  data: T[];
  xKey: string;
  series: CabAreaSeries<T>[];
  markers?: CabAreaChartMarker<T>[];
  title?: string;
  subtitle?: string;
  height?: number;
  yAxisWidth?: number;
  yTickFormatter?: (value: number) => string;
  actions?: ReactNode;
  notice?: string;
  loadingLabel?: string;
  ariaLabel?: string;
  summary?: string;
};

export function CabAreaChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  markers,
  title,
  subtitle,
  height,
  yAxisWidth,
  yTickFormatter,
  actions,
  notice,
  loadingLabel,
  ariaLabel,
  summary,
}: CabAreaChartProps<T>) {
  return (
    <CabChartFrame
      title={title}
      subtitle={subtitle}
      height={height}
      actions={actions} 
      notice={notice}
      loadingLabel={loadingLabel}
      ariaLabel={ariaLabel ?? title}
      summary={summary ?? subtitle}
    >
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 2 }}>
          <CartesianGrid stroke={cabColors.surface.border} strokeDasharray="3 3" />
          <XAxis dataKey={xKey as never} stroke={cabColors.text.muted} tick={{ fontSize: 12 }} />
          <YAxis
            stroke={cabColors.text.muted}
            tick={{ fontSize: 12 }}
            width={yAxisWidth ?? 72}
            tickFormatter={yTickFormatter}
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
          {series.map((item, index) => {
            const stroke =
              item.stroke ??
              (index === 0 ? cabColors.brandExtended.signalTealRaw : cabColors.brand.electricBlue);
            const defaultFill =
              index === 0 ? cabColors.brandExtended.signalTealGlow : `${cabColors.brand.electricBlue}26`;
            return (
              <Area
                key={item.key}
                dataKey={item.key as never}
                name={item.label}
                type="monotone"
                stroke={stroke}
                fill={item.fill ?? defaultFill}
                isAnimationActive={false}
              />
            );
          })}
          {markers?.flatMap((marker) =>
            data.map((datum, index) => {
              const markerValue = datum[marker.valueKey];
              const markerY = datum[marker.yKey];
              const markerX = datum[xKey as keyof T];

              if (
                typeof markerValue !== "number" ||
                !Number.isFinite(markerValue) ||
                markerValue <= 0 ||
                typeof markerY !== "number" ||
                !Number.isFinite(markerY) ||
                (typeof markerX !== "string" && typeof markerX !== "number")
              ) {
                return null;
              }

              const color = marker.color ?? cabColors.brand.cabGold;
              return (
                <ReferenceDot
                  key={`${marker.valueKey}-${String(markerX)}-${index}`}
                  x={markerX as never}
                  y={markerY as never}
                  r={marker.radius ?? 4}
                  fill={color}
                  stroke={color}
                  ifOverflow="extendDomain"
                />
              );
            }),
          )}
        </AreaChart>
      </ResponsiveContainer>
    </CabChartFrame>
  );
}
