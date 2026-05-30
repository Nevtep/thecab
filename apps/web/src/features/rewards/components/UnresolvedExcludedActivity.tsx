"use client";

import { CabDataPanel, CabText } from "@/design-system";
import type { SelectedReward } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = { selectedReward: SelectedReward; labels: Record<string, string | ((value: string) => string)> };

export function UnresolvedExcludedActivity({ selectedReward, labels }: Props) {
  const formatDateTime = labels.formatDateTime as (value: string) => string;

  return (
    <CabDataPanel>
      <CabText variant="mono" fontSize={13}>{labels.unresolvedExcluded as string}</CabText>
      <div className={styles.unresolvedList}>
        {selectedReward.unresolvedExcludedActivity.map((item) => (
          <div key={item.rewardEventId} className={styles.unresolvedItem}>
            <CabText fontSize={12}>{item.tokenSymbol ?? ""}</CabText>
            <CabText className={styles.numeric} fontSize={12} color="$secondary">{formatDateTime(item.occurredAt)}</CabText>
            <CabText fontSize={12} color="$secondary">{labels.reason as string}: {item.reasonCode}</CabText>
          </div>
        ))}
      </div>
    </CabDataPanel>
  );
}
