"use client";

import { CabBadge, CabCard, CabKeyValueList, CabLoadingPanel, CabStack, CabText, CabTokenIcon, CabTxHash, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

import styles from "@/features/activity/ActivityWorkspace.module.css";

type Props = {
  selectedActivity: ActivityViewModel["selectedActivity"];
  loading?: boolean;
  labels: {
    title: string;
    empty: string;
    loading: string;
    action: string;
    surface: string;
    occurredAt: string;
    txHash: string;
    coverage: string;
    confidence: string;
    movements: string;
    reasonCodes: string;
    getAction: (value: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getReason: (value: string) => string;
    formatDateTime: (value: string) => string;
  };
};

function coverageTone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "excluded" || coverage === "unresolved" || coverage === "unavailable") return "danger";
  return "neutral";
}

export function SelectedActivityRail({ selectedActivity, loading = false, labels }: Props) {
  if (loading) {
    return <CabLoadingPanel label={labels.loading} />;
  }

  if (!selectedActivity) {
    return (
      <CabCard className={styles.rail}>
        <CabText variant="heading" fontSize={13}>{labels.title}</CabText>
        <CabText variant="body" fontSize={13} color={cabColors.text.secondary}>{labels.empty}</CabText>
      </CabCard>
    );
  }

  return (
    <CabStack className={styles.rail}>
      <CabCard>
        <CabStack gap="$3">
          <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
            <CabStack row alignItems="center" gap="$2">
              <CabTokenIcon
                chainId={selectedActivity.chainId}
                tokenAddress={selectedActivity.primaryTokenAddress}
                symbol={selectedActivity.primaryTokenSymbol}
                size="md"
                decorative
              />
              <CabStack gap="$1">
                <CabText variant="heading" fontSize={16}>{labels.getAction(selectedActivity.action)}</CabText>
                <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
                  {labels.getSurface(selectedActivity.surface)}
                </CabText>
              </CabStack>
            </CabStack>
            <CabBadge tone={coverageTone(selectedActivity.coverage)} size="sm">
              {labels.getCoverage(selectedActivity.coverage)}
            </CabBadge>
          </CabStack>
          <CabKeyValueList
            items={[
              { key: "occurredAt", label: labels.occurredAt, value: labels.formatDateTime(selectedActivity.occurredAt), valueVariant: "mono" },
              {
                key: "tx",
                label: labels.txHash,
                value: selectedActivity.txHash ? (
                  <CabTxHash hash={selectedActivity.txHash} href={selectedActivity.externalTxUrl} />
                ) : "",
              },
              { key: "coverage", label: labels.coverage, value: labels.getCoverage(selectedActivity.coverage) },
              { key: "confidence", label: labels.confidence, value: labels.getConfidence(selectedActivity.confidence) },
            ]}
          />
        </CabStack>
      </CabCard>
      <CabCard>
        <CabStack gap="$3">
          <CabText variant="heading" fontSize={13}>{labels.movements}</CabText>
          {selectedActivity.movements.length ? (
            <CabKeyValueList
              items={selectedActivity.movements.map((movement) => ({
                key: movement.id,
                label: movement.direction === "in" ? "+" : "-",
                value: `${movement.tokenSymbol ?? movement.tokenAddress ?? ""} ${movement.amountRaw}`,
                valueVariant: "mono",
              }))}
            />
          ) : (
            <CabText variant="body" fontSize={12} color={cabColors.text.secondary}>{selectedActivity.summary}</CabText>
          )}
        </CabStack>
      </CabCard>
      {selectedActivity.reasonCodes.length ? (
        <CabCard>
          <CabStack gap="$2">
            <CabText variant="heading" fontSize={13}>{labels.reasonCodes}</CabText>
            {selectedActivity.reasonCodes.map((reasonCode) => (
              <CabBadge key={reasonCode} tone="warning" size="sm">{labels.getReason(reasonCode)}</CabBadge>
            ))}
          </CabStack>
        </CabCard>
      ) : null}
    </CabStack>
  );
}
