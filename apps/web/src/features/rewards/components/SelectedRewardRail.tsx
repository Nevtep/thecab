"use client";

import { CabCard, CabDataPanel, CabKeyValueList, CabStack, CabText, CabTokenIcon } from "@/design-system";
import { RewardClaimDetails } from "@/features/rewards/components/RewardClaimDetails";
import { RewardCoverageNotes } from "@/features/rewards/components/RewardCoverageNotes";
import { RewardOwnershipTrace } from "@/features/rewards/components/RewardOwnershipTrace";
import { RewardPoolContribution } from "@/features/rewards/components/RewardPoolContribution";
import { UnresolvedExcludedActivity } from "@/features/rewards/components/UnresolvedExcludedActivity";
import type { SelectedReward } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = {
  selectedReward: SelectedReward | null;
  labels: {
    title: string;
    amount: string;
    value: string;
    owner: string;
    coverage: string;
    confidence: string;
    empty: string;
    getCoverage: (coverage: string) => string;
    getConfidence: (confidence: string) => string;
    getSource: (source: string) => string;
    ownershipTrace: string;
    poolContribution: string;
    claimDetails: string;
    coverageNotes: string;
    unresolvedExcluded: string;
    linkedEntity: string;
    sourceSurface: string;
    evidence: string;
    status: string;
    pool: string;
    countingRule: string;
    txHash: string;
    claimTime: string;
    rewardType: string;
    openTx: string;
    reason: string;
    formatDateTime: (value: string) => string;
  };
};

export function SelectedRewardRail({ selectedReward, labels }: Props) {
  if (!selectedReward) {
    return (
      <CabDataPanel>
        <CabText>{labels.empty}</CabText>
      </CabDataPanel>
    );
  }

  return (
    <aside className={styles.rail}>
      <CabCard padding={12} gap="$2" density="default" className={styles.railSummary}>
        <CabText variant="mono" fontSize={12} color="$muted">{labels.title}</CabText>
        <CabStack row justifyContent="space-between" alignItems="flex-start" gap="$3">
          <CabStack row alignItems="center" gap="$2.5" minWidth={0}>
            <CabTokenIcon
              tokenAddress={selectedReward.summary.tokenAddress}
              symbol={selectedReward.summary.tokenSymbol}
              size={44}
              decorative
            />
            <CabStack gap="$1" minWidth={0}>
              <CabText variant="heading">{selectedReward.summary.tokenSymbol ?? ""}</CabText>
              <CabText fontSize={12} color="$secondary">
                {labels.getSource(selectedReward.summary.ownerStatus)}
              </CabText>
            </CabStack>
          </CabStack>
          <CabStack gap="$1" alignItems="flex-end" minWidth={0}>
            <CabText className={styles.numeric} variant="heading" fontSize={18}>
              {selectedReward.summary.tokenAmount ?? ""}
            </CabText>
            <CabText className={styles.numeric} fontSize={13} color="$secondary">
              {selectedReward.summary.usdValueAtClaim ?? ""}
            </CabText>
          </CabStack>
        </CabStack>
        <CabKeyValueList
          items={[
            { key: "amount", label: labels.amount, value: selectedReward.summary.tokenAmount ?? "", valueVariant: "mono" },
            { key: "value", label: labels.value, value: selectedReward.summary.usdValueAtClaim ?? "", valueVariant: "mono" },
            { key: "owner", label: labels.owner, value: labels.getSource(selectedReward.summary.ownerStatus) },
            { key: "coverage", label: labels.coverage, value: labels.getCoverage(selectedReward.summary.coverageState) },
            { key: "confidence", label: labels.confidence, value: labels.getConfidence(selectedReward.summary.confidence) },
          ]}
        />
      </CabCard>
      <RewardOwnershipTrace selectedReward={selectedReward} labels={labels} />
      <RewardPoolContribution selectedReward={selectedReward} labels={labels} />
      <RewardClaimDetails selectedReward={selectedReward} labels={labels} />
      <RewardCoverageNotes selectedReward={selectedReward} labels={labels} />
      <UnresolvedExcludedActivity selectedReward={selectedReward} labels={labels} />
    </aside>
  );
}
