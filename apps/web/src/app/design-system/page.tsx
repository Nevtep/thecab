"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CabAnalysisStatusBadge,
  CabBarChart,
  CabButton,
  CabCard,
  CabCoverageBadge,
  CabEmptyState,
  CabErrorPanel,
  CabInput,
  CabLineChart,
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

const chartData = [
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
    <CabCard padding="$3" gap="$2">
      <div
        style={{
          width: "100%",
          height: 56,
          borderRadius: 10,
          backgroundColor: value,
          border: `1px solid ${cabColors.surface.border}`,
        }}
      />
      <CabText variant="heading" fontSize="$2">
        {name}
      </CabText>
      <CabText variant="data" fontSize="$2" color={cabColors.text.secondary}>
        {value}
      </CabText>
    </CabCard>
  );
}

export default function DesignSystemShowcasePage() {
  const [range, setRange] = useState("7d");
  const [chartsReady, setChartsReady] = useState(false);

  useEffect(() => {
    setChartsReady(true);
  }, []);

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
        padding: "32px 24px 56px",
      }}
    >
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 24 }}>
        <CabSectionHeader
          title="Design System Showcase"
          subtitle="Storybook-style visual surface for palette and component validation"
          actions={<CabAnalysisStatusBadge status="ready" label="palette ready" />}
        />

        <CabCard>
          <CabStack gap="$3">
            <CabText variant="heading" fontSize="$6">
              Color Palette
            </CabText>
            {colorGroups.map((section) => (
              <CabStack key={section.group} gap="$2">
                <CabText variant="heading" fontSize="$4" color={cabColors.text.secondary}>
                  {section.group}
                </CabText>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
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
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          }}
        >
          <CabCard>
            <CabStack gap="$3">
              <CabText variant="heading" fontSize="$5">
                Typography
              </CabText>
              <CabText variant="display" fontSize="$8">
                Orbitron Display / Brand
              </CabText>
              <CabText variant="heading" fontSize="$5">
                Orbitron Heading / Section Label
              </CabText>
              <CabText variant="body" fontSize="$4">
                Inter Body / Navigation / Product copy for dense readable dashboards.
              </CabText>
              <CabText variant="data" fontSize="$4">
                IBM Plex Mono Data / 0x8Ae2...3f19 / $136,100.42 / 2026-05-13
              </CabText>
            </CabStack>
          </CabCard>

          <CabCard>
            <CabStack gap="$3">
              <CabText variant="heading" fontSize="$5">
                Primitives
              </CabText>
              <CabStack row gap="$2" flexWrap="wrap">
                <CabButton tone="primary">Primary</CabButton>
                <CabButton tone="secondary">Secondary</CabButton>
                <CabButton tone="ghost">Ghost</CabButton>
                <CabButton tone="warning">Warning</CabButton>
              </CabStack>
              <CabInput placeholder="CabInput tokenized background and border" />
              <CabStack row gap="$2" flexWrap="wrap">
                <CabCoverageBadge state="full" label="full" />
                <CabCoverageBadge state="share_level" label="share level" />
                <CabCoverageBadge state="partial" label="partial" />
                <CabCoverageBadge state="unknown" label="unknown" />
              </CabStack>
            </CabStack>
          </CabCard>
        </div>

        <CabCard>
          <CabStack gap="$3">
            <CabSectionHeader
              title="Metrics and Controls"
              subtitle="Color contrast check across primary informational surfaces"
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
                gap: 16,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          }}
        >
          {chartsReady ? (
            <>
              <CabLineChart
                title="Portfolio Value"
                subtitle="Signal teal and electric blue over dark grid"
                data={chartData}
                xKey="day"
                series={[
                  { key: "value", label: "Portfolio Value" },
                  { key: "rewards", label: "Rewards", color: cabColors.brand.cabGold },
                ]}
              />
              <CabBarChart
                title="Rewards by Day"
                subtitle="Bar palette validation"
                data={chartData}
                xKey="day"
                series={[{ key: "rewards", label: "Rewards" }]}
              />
            </>
          ) : (
            <>
              <CabLoadingPanel label="Preparing chart previews..." />
              <CabLoadingPanel label="Preparing chart previews..." />
            </>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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
