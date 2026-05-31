"use client";

import { CabBadge, CabCard, CabIcon, CabKeyValueList, CabLoadingPanel, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  selectedDetail: GovernanceViewModel["selectedDetail"];
  loading?: boolean;
  labels: {
    title: string;
    empty: string;
    loading: string;
    actionSummary: string;
    transaction: string;
    protocolSurface: string;
    valueEffect: string;
    epochContext: string;
    poolContext: string;
    classificationEvidence: string;
    coverageNotes: string;
    txHash: string;
    occurredAt: string;
    coverage: string;
    confidence: string;
    affectsTotals: string;
    yes: string;
    no: string;
    getActionLabel: (key: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    formatDateTime: (value: string | null) => string;
    formatUsd: (value: string | null) => string;
  };
};

function toneForCoverage(coverage: string) {
  if (coverage === "full") return "success" as const;
  if (coverage === "partial") return "warning" as const;
  if (coverage === "excluded" || coverage === "unsupported") return "danger" as const;
  return "neutral" as const;
}

function shortHash(value: string | null) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "n/a";
}

function recordLabel(record: Record<string, unknown> | null) {
  if (!record) return "n/a";
  const explicit = record.label;
  if (typeof explicit === "string" && explicit.trim().length > 0) return explicit;
  const id = record.epochId ?? record.poolId ?? record.id;
  return typeof id === "string" ? id : "n/a";
}

export function SelectedGovernanceRail({ selectedDetail, loading = false, labels }: Props) {
  if (loading) {
    return <CabLoadingPanel label={labels.loading} />;
  }

  return (
    <CabStack className={styles.rail}>
      <CabCard density="compact">
        <CabStack gap="$3">
          <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
            <CabStack row alignItems="center" gap="$2">
              <CabIcon name="radar" size="sm" tone="signal" />
              <CabText variant="label">{labels.title}</CabText>
            </CabStack>
            <CabBadge tone={toneForCoverage(selectedDetail.coverageNotes.coverageState)} size="sm">
              {labels.getCoverage(selectedDetail.coverageNotes.coverageState)}
            </CabBadge>
          </CabStack>

          {selectedDetail.selectionKind === "empty" ? (
            <CabText variant="body" color={cabColors.text.secondary}>{labels.empty}</CabText>
          ) : (
            <>
              <CabStack gap="$1">
                <CabText variant="caption" color={cabColors.text.secondary}>{labels.actionSummary}</CabText>
                <CabText variant="heading" fontSize={16}>
                  {labels.getActionLabel(selectedDetail.actionSummary.labelKey)}
                </CabText>
                {selectedDetail.actionSummary.contextLabel ? (
                  <CabText variant="caption" color={cabColors.text.secondary}>
                    {selectedDetail.actionSummary.contextLabel}
                  </CabText>
                ) : null}
              </CabStack>

              <CabKeyValueList
                items={[
                  { key: "tx", label: labels.txHash, value: shortHash(selectedDetail.transaction.txHash), valueVariant: "mono" },
                  { key: "time", label: labels.occurredAt, value: labels.formatDateTime(selectedDetail.transaction.occurredAt), valueVariant: "mono" },
                  { key: "surface", label: labels.protocolSurface, value: labels.getSurface(selectedDetail.protocolSurface), valueVariant: "mono" },
                  { key: "value", label: labels.valueEffect, value: labels.formatUsd(selectedDetail.valueEffect.valueUsd), valueVariant: "mono" },
                  { key: "epoch", label: labels.epochContext, value: recordLabel(selectedDetail.epochContext), valueVariant: "mono" },
                  { key: "pool", label: labels.poolContext, value: recordLabel(selectedDetail.poolContext), valueVariant: "mono" },
                  { key: "confidence", label: labels.confidence, value: labels.getConfidence(selectedDetail.coverageNotes.confidence), valueVariant: "mono" },
                  { key: "affectsTotals", label: labels.affectsTotals, value: selectedDetail.coverageNotes.affectsTotals ? labels.yes : labels.no, valueVariant: "mono" },
                ]}
              />
            </>
          )}
        </CabStack>
      </CabCard>

      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.classificationEvidence}</CabText>
          {(selectedDetail.classificationEvidence.basis.length > 0
            ? selectedDetail.classificationEvidence.basis
            : selectedDetail.classificationEvidence.reasonCodes
          ).slice(0, 5).map((entry) => (
            <CabStack key={entry} row alignItems="center" gap="$2">
              <CabIcon name="activity" width={12} height={12} color={cabColors.semantic.success} />
              <CabText variant="caption" color={cabColors.text.secondary}>{entry}</CabText>
            </CabStack>
          ))}
        </CabStack>
      </CabCard>

      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.coverageNotes}</CabText>
          <CabStack row gap="$2" flexWrap="wrap">
            <CabBadge tone={toneForCoverage(selectedDetail.coverageNotes.coverageState)} size="sm">
              {labels.getCoverage(selectedDetail.coverageNotes.coverageState)}
            </CabBadge>
            <CabBadge tone="info" size="sm" variant="emphasis">
              {labels.getConfidence(selectedDetail.coverageNotes.confidence)}
            </CabBadge>
          </CabStack>
          {selectedDetail.coverageNotes.reasonCodes.length > 0 ? (
            <CabText variant="caption" color={cabColors.text.secondary}>
              {selectedDetail.coverageNotes.reasonCodes.join(" · ")}
            </CabText>
          ) : null}
        </CabStack>
      </CabCard>
    </CabStack>
  );
}
