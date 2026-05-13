"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { CabBarChartProps } from "@/design-system/charts/CabBarChart";
import type { CabLineChartProps } from "@/design-system/charts/CabLineChart";

import {
  CabAnalysisStatusBadge,
  CabButton,
  CabCard,
  CabCoverageBadge,
  CabEmptyState,
  CabErrorPanel,
  CabInput,
  CabLoadingPanel,
  CabMetricCard,
  CabPartialCoverageNotice,
  CabRangeSelector,
  CabSectionHeader,
  CabStack,
  CabText,
  CabUnsupportedEventNotice,
  cabColors,
} from "@/design-system";

type ShowcaseChartDatum = {
  day: string;
  value: number;
  rewards: number;
};

const ClientCabLineChart = dynamic<CabLineChartProps<ShowcaseChartDatum>>(
  () => import("@/design-system/charts/CabLineChart").then((module) => module.CabLineChart),
  {
    ssr: false,
    loading: () => <CabLoadingPanel label="Preparing chart previews..." />,
  },
);

const ClientCabBarChart = dynamic<CabBarChartProps<ShowcaseChartDatum>>(
  () => import("@/design-system/charts/CabBarChart").then((module) => module.CabBarChart),
  {
    ssr: false,
    loading: () => <CabLoadingPanel label="Preparing chart previews..." />,
  },
);

type ColorGroup = {
  group: string;
  colors: Record<string, string>;
};

const colorGroups: ColorGroup[] = [
  { group: "Brand", colors: cabColors.brand },
  { group: "Surface", colors: cabColors.surface },
  { group: "Text", colors: cabColors.text },
  { group: "Semantic", colors: cabColors.semantic },
];

const chartData: ShowcaseChartDatum[] = [
  { day: "Mon", value: 124000, rewards: 120 },
  { day: "Tue", value: 128500, rewards: 160 },
  { day: "Wed", value: 126300, rewards: 135 },
  { day: "Thu", value: 131200, rewards: 190 },
  { day: "Fri", value: 134600, rewards: 210 },
  { day: "Sat", value: 133900, rewards: 170 },
  { day: "Sun", value: 136100, rewards: 230 },
];

function ColorSwatch({ name, value }: { name: string; value: string }) {
  return (
    <CabCard padding="$4" gap="$3" density="default">
      <div
        style={{
          width: "100%",
          height: 72,
          borderRadius: 10,
          backgroundColor: value,
          border: `1px solid ${cabColors.surface.border}`,
        }}
      />
      <CabText variant="label" fontSize={12} color={cabColors.text.primary}>
        {name}
      </CabText>
      <CabText variant="mono" fontSize={11} color={cabColors.text.secondary}>
        {value}
      </CabText>
    </CabCard>
  );
}

export default function DesignSystemShowcasePage() {
  const [range, setRange] = useState("7d");

  const rangeOptions = useMemo(
    () => [
      { key: "24h", label: "24H" },
      { key: "7d", label: "7D" },
      { key: "30d", label: "30D" },
      { key: "90d", label: "90D" },
    ],
    [],
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 700px at 100% -10%, rgba(0,224,225,0.10), transparent 50%), radial-gradient(1000px 600px at -10% -10%, rgba(59,130,246,0.10), transparent 55%), #040F1C",
        color: cabColors.text.primary,
        padding: "40px 28px 64px",
      }}
    >
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gap: 28 }}>
        <CabSectionHeader
          title="Design System Showcase"
          subtitle="Aviation-inspired control surface validation for palette, typography, controls, and status components"
          actions={<CabAnalysisStatusBadge status="ready" label="palette ready" />}
        />

        <CabCard density="spacious">
          <CabStack gap="$4">
            <CabText variant="heading" fontSize={17}>
              Color Palette
            </CabText>
            {colorGroups.map((section) => (
              <CabStack key={section.group} gap="$3">
                <CabText variant="label" fontSize={13} color={cabColors.text.secondary}>
                  {section.group}
                </CabText>
                <div
                  style={{
                    display: "grid",
                    gap: 16,
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  }}
                >
                  {Object.entries(section.colors).map(([name, value]) => (
                    <ColorSwatch key={name} name={name} value={value} />
                  ))}
                </div>
              </CabStack>
            ))}
          </CabStack>
        </CabCard>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          }}
        >
          <CabCard density="spacious">
            <CabStack gap="$4">
              <CabText variant="heading" fontSize={16}>
                Typography
              </CabText>
              <CabText variant="display" fontSize={30}>
                Orbitron Display / Brand
              </CabText>
              <CabText variant="heading" fontSize={17}>
                Orbitron Heading / Major Section Anchor
              </CabText>
              <CabText variant="body" fontSize={13}>
                Inter Body / Navigation / Product copy for dense readable dashboards.
              </CabText>
              <CabText variant="mono" fontSize={11}>
                IBM Plex Mono Data / 0x8Ae2...3f19 / $136,100.42 / 2026-05-13
              </CabText>
            </CabStack>
          </CabCard>

          <CabCard density="spacious">
            <CabStack gap="$4">
              <CabText variant="heading" fontSize={16}>
                Primitives
              </CabText>
              <CabText variant="caption" fontSize={12} color={cabColors.text.muted}>
                Default-size controls (md) for realistic dashboard interaction states.
              </CabText>
              <CabStack row gap="$3" flexWrap="wrap">
                <CabButton tone="primary" controlSize="md">
                  Primary
                </CabButton>
                <CabButton tone="secondary" controlSize="md">
                  Secondary
                </CabButton>
                <CabButton tone="technical" controlSize="md">
                  Technical
                </CabButton>
                <CabButton tone="ghost" controlSize="md">
                  Ghost
                </CabButton>
                <CabButton tone="warning" controlSize="md">
                  Warning
                </CabButton>
              </CabStack>
              <CabInput
                controlSize="md"
                placeholder="CabInput with readable padding, subtle border, restrained teal focus"
              />
              <CabText variant="caption" fontSize={12} color={cabColors.text.muted}>
                Compact status chips are separate from action buttons.
              </CabText>
              <CabStack row gap="$3" flexWrap="wrap">
                <CabCoverageBadge state="full" label="full" />
                <CabCoverageBadge state="share_level" label="share level" />
                <CabCoverageBadge state="partial" label="partial" />
                <CabCoverageBadge state="unknown" label="unknown" />
              </CabStack>
            </CabStack>
          </CabCard>
        </div>

        <CabCard density="spacious">
          <CabStack gap="$4">
            <CabSectionHeader
              title="Metrics and Controls"
              subtitle="Readable KPI density with filter controls that remain compact but usable"
              actions={
                <CabRangeSelector
                  options={rangeOptions}
                  selectedKey={range}
                  onSelect={setRange}
                />
              }
            />
            <div
              style={{
                display: "grid",
                gap: 20,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              <CabMetricCard label="Net Portfolio" value="$136,100.42" delta={3.24} />
              <CabMetricCard label="Rewards" value="$1,245.70" delta={0.83} />
              <CabMetricCard label="Residual" value="$8,430.16" delta={-1.21} />
            </div>
          </CabStack>
        </CabCard>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          }}
        >
          <ClientCabLineChart
            title="Portfolio Value"
            subtitle="Signal teal and electric blue over dark grid"
            data={chartData}
            xKey="day"
            series={[
              { key: "value", label: "Portfolio Value" },
              { key: "rewards", label: "Rewards", color: cabColors.brand.cabGold },
            ]}
          />
          <ClientCabBarChart
            title="Rewards by Day"
            subtitle="Bar palette validation"
            data={chartData}
            xKey="day"
            series={[{ key: "rewards", label: "Rewards" }]}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 20,
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          }}
        >
          <CabEmptyState
            title="No Data Imported"
            description="This state validates muted text, border, and icon tones."
          />
          <CabLoadingPanel label="Syncing on-chain snapshots..." />
          <CabErrorPanel
            title="Connection Error"
            description="This validates semantic danger usage in critical UI states."
          />
          <CabPartialCoverageNotice
            title="Partial Coverage"
            description="Some pool history is incomplete for selected range."
          />
          <CabUnsupportedEventNotice
            title="Unsupported Event"
            description="Event type is not represented in current decoding rules."
          />
        </div>
      </div>
    </main>
  );
}
