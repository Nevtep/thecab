"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { CabCard, CabEmptyState, CabStack } from "@/design-system";
import { AllocationSummaryCards } from "@/features/overview/AllocationSummaryCards";
import { CapitalAllocationHeader } from "@/features/overview/CapitalAllocationHeader";
import { ConcentricCapitalDonut } from "@/features/overview/ConcentricCapitalDonut";
import { CoverageFooter } from "@/features/overview/CoverageFooter";
import { UnderlyingAssetsPanel } from "@/features/overview/UnderlyingAssetsPanel";
import {
  buildCapitalAllocationSliceSummaries,
  buildCapitalAllocationStatusBadges,
  buildDistributionCompositionBreakdown,
  buildIdleAssetBreakdown,
} from "@/features/overview/capitalAllocation.utils";
import type { OverviewRange, OverviewViewModel } from "@/features/overview/overview.types";

type CapitalAllocationSectionProps = {
  distribution: OverviewViewModel["distribution"];
  assetRows: OverviewViewModel["assets"]["rows"];
  range: OverviewRange;
};

export function CapitalAllocationSection({ distribution, assetRows, range }: CapitalAllocationSectionProps) {
  const { t } = useTranslation("overview");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const sliceSummaries = useMemo(
    () => buildCapitalAllocationSliceSummaries(distribution.slices, t),
    [distribution.slices, t],
  );
  const eligibleDistributionAssetRows = useMemo(
    () => assetRows.filter((row) => !row.isHiddenByDefault && row.priceUsd !== null && !row.trustReasonCodes.includes("zeroOrDustValue")),
    [assetRows],
  );
  const compositionBreakdowns = useMemo(
    () => {
      const breakdowns = distribution.slices
        .filter((slice) => slice.dimension !== "idle")
        .map((slice) => buildDistributionCompositionBreakdown(slice, eligibleDistributionAssetRows))
        .filter((breakdown): breakdown is NonNullable<typeof breakdown> => breakdown !== null);
      const idleSlice = distribution.slices.find((slice) => slice.dimension === "idle");

      if (idleSlice) {
        const idleBreakdown = buildIdleAssetBreakdown(idleSlice, eligibleDistributionAssetRows.filter((row) => row.classification === "idle"));

        if (idleBreakdown) {
          breakdowns.push(idleBreakdown);
        }
      }

      return breakdowns;
    },
    [distribution.slices, eligibleDistributionAssetRows],
  );
  const totalValueUsd = useMemo(
    () => sliceSummaries.reduce((sum, item) => sum + item.valueUsd, 0),
    [sliceSummaries],
  );
  const badges = useMemo(
    () => buildCapitalAllocationStatusBadges(distribution, t),
    [distribution, t],
  );

  if (sliceSummaries.length === 0) {
    return (
      <CabCard density="spacious">
        <CabEmptyState
          title={t("states.emptyDistributionTitle")}
          description={t("states.emptyDistributionDescription")}
        />
      </CabCard>
    );
  }

  const selectedSlice = sliceSummaries.find((item) => item.key === selectedKey) ?? sliceSummaries[0];
  const selectedBreakdown = compositionBreakdowns.find((breakdown) => breakdown.key === selectedSlice.key) ?? null;

  return (
    <CabCard density="spacious">
      <CabStack gap="$4">
        <CapitalAllocationHeader totalValueUsd={totalValueUsd} badges={badges} />

        <div
          style={{
            display: "grid",
            gap: 20,
            alignItems: "start",
            gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          }}
        >
          <ConcentricCapitalDonut
            items={sliceSummaries}
            selectedSlice={selectedSlice}
            selectedBreakdown={selectedBreakdown}
            range={range}
            onSelectSlice={setSelectedKey}
          />

          <CabStack gap="$3">
            <AllocationSummaryCards
              items={sliceSummaries}
              selectedKey={selectedSlice.key}
              onSelect={setSelectedKey}
            />
            <UnderlyingAssetsPanel
              selectedSlice={selectedSlice}
              selectedBreakdown={selectedBreakdown}
            />
          </CabStack>
        </div>

        <CoverageFooter
          exclusions={distribution.exclusions}
          coverageStatus={distribution.coverageStatus}
          source={distribution.source}
        />
      </CabStack>
    </CabCard>
  );
}