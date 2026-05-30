"use client";

import { CabDataPanel, CabKeyValueList, CabText } from "@/design-system";
import type { SelectedReward } from "@/features/rewards/rewards.types";

type Props = { selectedReward: SelectedReward; labels: Record<string, string | ((value: string) => string)> };

export function RewardOwnershipTrace({ selectedReward, labels }: Props) {
  const getSource = labels.getSource as (value: string) => string;
  return (
    <CabDataPanel>
      <CabText variant="mono" fontSize={13}>{labels.ownershipTrace as string}</CabText>
      <CabKeyValueList
        items={[
          { key: "owner", label: labels.owner as string, value: getSource(selectedReward.ownershipTrace.ownerStatus) },
          { key: "linkedEntity", label: labels.linkedEntity as string, value: selectedReward.ownershipTrace.linkedEntityLabel ?? "", valueVariant: "mono" },
          { key: "sourceSurface", label: labels.sourceSurface as string, value: selectedReward.ownershipTrace.sourceSurface },
          { key: "evidence", label: labels.evidence as string, value: selectedReward.ownershipTrace.evidenceKey },
        ]}
      />
    </CabDataPanel>
  );
}
