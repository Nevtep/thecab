"use client";

import { CabBadge, CabCard, CabIcon, CabKeyValueList, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  lockPanel: GovernanceViewModel["lockPanel"];
  labels: {
    title: string;
    empty: string;
    status: string;
    lockId: string;
    createdAt: string;
    expiresAt: string;
    lockedAero: string;
    veAero: string;
    coverage: string;
    confidence: string;
    lifecycle: string;
    noLifecycle: string;
    getStatus: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getEvent: (value: string) => string;
    unavailable: string;
    formatDateTime: (value: string | null) => string;
    formatAmount: (value: string | null) => string;
    formatUsd: (value: string | null) => string;
  };
};

function toneForCoverage(coverage: string) {
  if (coverage === "full") return "success" as const;
  if (coverage === "partial") return "warning" as const;
  if (coverage === "excluded" || coverage === "unsupported") return "danger" as const;
  return "neutral" as const;
}

export function GovernanceLockPanel({ lockPanel, labels }: Props) {
  return (
    <CabCard density="compact">
      <CabStack gap="$3">
        <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
          <CabStack row alignItems="center" gap="$2">
            <CabIcon name="lock" size="sm" tone="signal" />
            <CabText variant="label">{labels.title}</CabText>
          </CabStack>
          {lockPanel ? (
            <CabBadge tone={toneForCoverage(lockPanel.coverageState)} size="sm">
              {labels.getCoverage(lockPanel.coverageState)}
            </CabBadge>
          ) : null}
        </CabStack>

        {!lockPanel ? (
          <CabText variant="body" color={cabColors.text.secondary}>{labels.empty}</CabText>
        ) : (
          <>
            <CabKeyValueList
              items={[
                { key: "status", label: labels.status, value: labels.getStatus(lockPanel.status), valueVariant: "mono" },
                { key: "lockId", label: labels.lockId, value: lockPanel.lockId ?? labels.unavailable, valueVariant: "mono" },
                { key: "createdAt", label: labels.createdAt, value: labels.formatDateTime(lockPanel.createdAt), valueVariant: "mono" },
                { key: "expiresAt", label: labels.expiresAt, value: labels.formatDateTime(lockPanel.expiresAt), valueVariant: "mono" },
                {
                  key: "lockedAero",
                  label: labels.lockedAero,
                  value: `${labels.formatAmount(lockPanel.lockedAeroAmount)} (${labels.formatUsd(lockPanel.lockedAeroValueUsd)})`,
                  valueVariant: "mono",
                },
                { key: "veAero", label: labels.veAero, value: labels.formatAmount(lockPanel.veAeroExposure), valueVariant: "mono" },
                { key: "confidence", label: labels.confidence, value: labels.getConfidence(lockPanel.confidence), valueVariant: "mono" },
              ]}
            />

            <CabStack gap="$2">
              <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>{labels.lifecycle}</CabText>
              {lockPanel.lifecycle.length === 0 ? (
                <CabText variant="caption" color={cabColors.text.muted}>{labels.noLifecycle}</CabText>
              ) : (
                <CabStack className={styles.lockLifecycle}>
                  {lockPanel.lifecycle.slice(0, 4).map((item) => (
                    <CabStack key={item.eventId} row alignItems="center" justifyContent="space-between" gap="$3">
                      <CabStack gap="$1" minWidth={0}>
                        <CabText variant="label" fontSize={12}>{labels.getEvent(item.eventType)}</CabText>
                        <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                          {labels.formatDateTime(item.occurredAt)}
                        </CabText>
                      </CabStack>
                      <CabBadge tone={toneForCoverage(item.coverageState)} size="sm">
                        {labels.getCoverage(item.coverageState)}
                      </CabBadge>
                    </CabStack>
                  ))}
                </CabStack>
              )}
            </CabStack>
          </>
        )}
      </CabStack>
    </CabCard>
  );
}
