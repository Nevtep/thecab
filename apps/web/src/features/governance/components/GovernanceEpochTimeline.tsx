"use client";

import { CabBadge, CabCard, CabIcon, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  epochs: GovernanceViewModel["epochTimeline"]["epochs"];
  labels: {
    title: string;
    empty: string;
    votedPools: string;
    voteMode: string;
    rewardState: string;
    resetState: string;
    fees: string;
    bribes: string;
    rebases: string;
    getCoverage: (value: string) => string;
    getVoteMode: (value: string) => string;
    getRewardState: (value: string) => string;
    getResetState: (value: string) => string;
    unavailable: string;
    formatUsd: (value: string | null) => string;
  };
};

function toneForCoverage(coverage: string) {
  if (coverage === "full") return "success" as const;
  if (coverage === "partial") return "warning" as const;
  if (coverage === "excluded" || coverage === "unsupported") return "danger" as const;
  return "neutral" as const;
}

export function GovernanceEpochTimeline({ epochs, labels }: Props) {
  return (
    <CabCard density="compact">
      <CabStack gap="$3">
        <CabStack row alignItems="center" gap="$2">
          <CabIcon name="governance" size="sm" tone="signal" />
          <CabText variant="label">{labels.title}</CabText>
        </CabStack>

        {epochs.length === 0 ? (
          <CabText variant="body" color={cabColors.text.secondary}>{labels.empty}</CabText>
        ) : (
          <div className={styles.epochList}>
            {epochs.slice(-4).map((epoch) => (
              <CabCard key={epoch.epochId} density="compact" className={styles.epochCard}>
                <CabStack gap="$2">
                  <CabStack row justifyContent="space-between" alignItems="center" gap="$2">
                    <CabText variant="label">{epoch.epochLabel}</CabText>
                    <CabBadge tone={toneForCoverage(epoch.coverageState)} size="sm">
                      {labels.getCoverage(epoch.coverageState)}
                    </CabBadge>
                  </CabStack>
                  <CabStack gap="$1">
                    <CabText variant="caption" color={cabColors.text.secondary}>{labels.votedPools}</CabText>
                    <CabText variant="body" fontSize={12}>
                      {epoch.votedPools.length > 0
                        ? epoch.votedPools.slice(0, 3).map((pool) => pool.label).join(" · ")
                        : labels.unavailable}
                    </CabText>
                  </CabStack>
                  <CabStack row justifyContent="space-between" gap="$2">
                    <CabText variant="caption" color={cabColors.text.secondary}>{labels.voteMode}</CabText>
                    <CabText variant="mono" fontSize={11}>{labels.getVoteMode(epoch.voteMode)}</CabText>
                  </CabStack>
                  <CabStack row justifyContent="space-between" gap="$2">
                    <CabText variant="caption" color={cabColors.text.secondary}>{labels.rewardState}</CabText>
                    <CabText variant="mono" fontSize={11}>{labels.getRewardState(epoch.rewardState)}</CabText>
                  </CabStack>
                  <CabStack row justifyContent="space-between" gap="$2">
                    <CabText variant="caption" color={cabColors.text.secondary}>{labels.resetState}</CabText>
                    <CabText variant="mono" fontSize={11}>{labels.getResetState(epoch.resetState)}</CabText>
                  </CabStack>
                  <CabStack row gap="$2" flexWrap="wrap">
                    <CabBadge tone="info" size="sm" variant="emphasis">{labels.fees}: {labels.formatUsd(epoch.feesUsd)}</CabBadge>
                    <CabBadge tone="warning" size="sm" variant="emphasis">{labels.bribes}: {labels.formatUsd(epoch.bribesUsd)}</CabBadge>
                    <CabBadge tone="neutral" size="sm" variant="emphasis">{labels.rebases}: {labels.formatUsd(epoch.rebasesUsd)}</CabBadge>
                  </CabStack>
                </CabStack>
              </CabCard>
            ))}
          </div>
        )}
      </CabStack>
    </CabCard>
  );
}
