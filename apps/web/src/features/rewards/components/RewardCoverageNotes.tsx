"use client";

import { CabDataPanel, CabKeyValueList, CabText } from "@/design-system";
import type { SelectedReward } from "@/features/rewards/rewards.types";

type Props = { selectedReward: SelectedReward; labels: Record<string, string | ((value: string) => string)> };

export function RewardCoverageNotes({ selectedReward, labels }: Props) {
  const getCoverage = labels.getCoverage as (value: string) => string;
  return (
    <CabDataPanel>
      <CabText variant="mono" fontSize={13}>{labels.coverageNotes as string}</CabText>
      <CabKeyValueList
        items={[
          { key: "coverage", label: labels.coverage as string, value: getCoverage(selectedReward.coverageNotes.coverageState) },
          { key: "reason", label: labels.reason as string, value: selectedReward.coverageNotes.reasonCodes.join(", ") },
        ]}
      />
    </CabDataPanel>
  );
}
