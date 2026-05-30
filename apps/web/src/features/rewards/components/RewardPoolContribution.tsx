"use client";

import { CabDataPanel, CabKeyValueList, CabText } from "@/design-system";
import type { SelectedReward } from "@/features/rewards/rewards.types";

type Props = { selectedReward: SelectedReward; labels: Record<string, string | ((value: string) => string)> };

export function RewardPoolContribution({ selectedReward, labels }: Props) {
  return (
    <CabDataPanel>
      <CabText variant="mono" fontSize={13}>{labels.poolContribution as string}</CabText>
      <CabKeyValueList
        items={[
          { key: "status", label: labels.status as string, value: selectedReward.poolContribution.status },
          { key: "pool", label: labels.pool as string, value: selectedReward.poolContribution.linkedPoolLabel ?? "" },
          { key: "countingRule", label: labels.countingRule as string, value: selectedReward.poolContribution.countingRuleKey },
        ]}
      />
    </CabDataPanel>
  );
}
