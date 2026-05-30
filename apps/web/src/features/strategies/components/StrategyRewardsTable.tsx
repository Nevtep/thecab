"use client";

import { CabBadge, CabCard, CabStack, CabText, CabTxHash } from "@/design-system";
import { getStrategyTxExplorerUrl } from "@/features/strategies/strategies.mappers";
import type { StrategyRewardView } from "@/features/strategies/strategies.types";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategyRewardsTableProps = {
  chainId: number;
  locale: string;
  rewards: StrategyRewardView[];
  labels: {
    title: string;
    empty: string;
    token: string;
    amount: string;
    value: string;
    claimedAt: string;
    transaction: string;
    status: string;
    resolved: string;
    unresolved: string;
  };
};

function formatUsd(value: number | null, locale: string) {
  if (value === null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatAmount(reward: StrategyRewardView) {
  const amount = reward.amountFormatted ?? reward.amountRaw ?? "—";
  return reward.tokenSymbol ? `${amount} ${reward.tokenSymbol}` : amount;
}

export function StrategyRewardsTable({ chainId, labels, locale, rewards }: StrategyRewardsTableProps) {
  return (
    <CabCard density="compact">
      <CabStack gap="$2">
        <CabText variant="label">{labels.title}</CabText>
        {rewards.length === 0 ? (
          <CabText variant="caption">{labels.empty}</CabText>
        ) : (
          <div className={styles.compactTableWrap}>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th>{labels.token}</th>
                  <th>{labels.amount}</th>
                  <th>{labels.value}</th>
                  <th>{labels.claimedAt}</th>
                  <th>{labels.transaction}</th>
                  <th>{labels.status}</th>
                </tr>
              </thead>
              <tbody>
                {rewards.map((reward) => (
                  <tr key={reward.id}>
                    <td>{reward.tokenSymbol ?? reward.tokenAddress ?? "—"}</td>
                    <td>{formatAmount(reward)}</td>
                    <td>{formatUsd(reward.amountUsd, locale)}</td>
                    <td>{formatDate(reward.claimedAt, locale)}</td>
                    <td>
                      {reward.txHash ? (
                        <CabTxHash hash={reward.txHash} href={getStrategyTxExplorerUrl(chainId, reward.txHash)} />
                      ) : "—"}
                    </td>
                    <td>
                      <CabBadge tone={reward.resolutionStatus === "resolved" ? "success" : "warning"} size="sm">
                        {reward.resolutionStatus === "resolved" ? labels.resolved : labels.unresolved}
                      </CabBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CabStack>
    </CabCard>
  );
}
