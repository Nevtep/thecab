"use client";

import { CabBadge, CabCard, CabIcon, CabKeyValueList, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  locks: GovernanceViewModel["locks"];
  labels: {
    title: string;
    empty: string;
    primary: string;
    kind: string;
    status: string;
    lockId: string;
    managedTokenId: string;
    createdAt: string;
    expiresAt: string;
    lockedAero: string;
    veAero: string;
    coverage: string;
    confidence: string;
    lifecycle: string;
    noLifecycle: string;
    getKind: (value: string) => string;
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

export function GovernanceLockPanel({ locks, labels }: Props) {
  return (
    <CabCard density="compact">
      <CabStack gap="$3">
        <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
          <CabStack row alignItems="center" gap="$2">
            <CabIcon name="lock" size="sm" tone="signal" />
            <CabText variant="label">{labels.title}</CabText>
          </CabStack>
        </CabStack>

        {locks.rows.length === 0 ? (
          <CabText variant="body" color={cabColors.text.secondary}>{labels.empty}</CabText>
        ) : (
          <CabStack gap="$4">
            {locks.rows.map((lockPanel) => {
              const items = [
                { key: "kind", label: labels.kind, value: labels.getKind(lockPanel.lockKind), valueVariant: "mono" as const },
                { key: "status", label: labels.status, value: labels.getStatus(lockPanel.status), valueVariant: "mono" as const },
                { key: "lockId", label: labels.lockId, value: lockPanel.lockId ?? labels.unavailable, valueVariant: "mono" as const },
                ...(lockPanel.managedTokenId
                  ? [{ key: "managedTokenId", label: labels.managedTokenId, value: lockPanel.managedTokenId, valueVariant: "mono" as const }]
                  : []),
                { key: "createdAt", label: labels.createdAt, value: labels.formatDateTime(lockPanel.createdAt), valueVariant: "mono" as const },
                { key: "expiresAt", label: labels.expiresAt, value: labels.formatDateTime(lockPanel.expiresAt), valueVariant: "mono" as const },
                {
                  key: "lockedAero",
                  label: labels.lockedAero,
                  value: `${labels.formatAmount(lockPanel.lockedAeroAmount)} (${labels.formatUsd(lockPanel.lockedAeroValueUsd)})`,
                  valueVariant: "mono" as const,
                },
                { key: "veAero", label: labels.veAero, value: labels.formatAmount(lockPanel.veAeroExposure), valueVariant: "mono" as const },
                { key: "confidence", label: labels.confidence, value: labels.getConfidence(lockPanel.confidence), valueVariant: "mono" as const },
              ];

              return (
                <CabStack key={lockPanel.lockExposureId ?? lockPanel.lockId ?? labels.unavailable} gap="$3">
                  <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
                    <CabText variant="label">{labels.getKind(lockPanel.lockKind)}</CabText>
                    <CabStack row alignItems="center" gap="$2">
                      {(lockPanel.lockExposureId ?? lockPanel.lockId) === locks.primaryLockId ? (
                        <CabBadge tone="info" size="sm" variant="emphasis">{labels.primary}</CabBadge>
                      ) : null}
                      <CabBadge tone={toneForCoverage(lockPanel.coverageState)} size="sm">
                        {labels.getCoverage(lockPanel.coverageState)}
                      </CabBadge>
                    </CabStack>
                  </CabStack>

                  <CabKeyValueList items={items} />

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
                </CabStack>
              );
            })}
          </CabStack>
        )}
      </CabStack>
    </CabCard>
  );
}
