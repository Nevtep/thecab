"use client";

import { CabDataPanel, CabIcon, CabKeyValueList, CabText } from "@/design-system";
import type { SelectedReward } from "@/features/rewards/rewards.types";

import styles from "@/features/rewards/RewardsWorkspace.module.css";

type Props = { selectedReward: SelectedReward; labels: Record<string, string | ((value: string) => string)> };

export function RewardClaimDetails({ selectedReward, labels }: Props) {
  const formatDateTime = labels.formatDateTime as (value: string) => string;

  return (
    <CabDataPanel>
      <CabText variant="mono" fontSize={13}>{labels.claimDetails as string}</CabText>
      <CabKeyValueList
        items={[
          {
            key: "txHash",
            label: labels.txHash as string,
            value: selectedReward.claimDetails.externalTxUrl ? (
              <a
                className={styles.externalLink}
                href={selectedReward.claimDetails.externalTxUrl}
              target="_blank"
              rel="noreferrer"
            >
              {selectedReward.claimDetails.txHash ?? ""}
              <CabIcon name="externalLink" width={13} height={13} />
              <span className={styles.srOnly}>{labels.openTx as string}</span>
            </a>
            ) : selectedReward.claimDetails.txHash ?? "",
            valueVariant: "mono",
          },
          {
            key: "claimTime",
            label: labels.claimTime as string,
            value: formatDateTime(selectedReward.claimDetails.claimTime),
            valueVariant: "mono",
          },
          { key: "rewardType", label: labels.rewardType as string, value: selectedReward.claimDetails.rewardType },
        ]}
      />
    </CabDataPanel>
  );
}
