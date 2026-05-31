"use client";

import { CabBadge, CabCard, CabIcon, CabKeyValueList, CabLoadingPanel, CabSeparator, CabStack, CabText, CabTokenIcon, CabTxHash, cabColors } from "@/design-system";
import { GovernanceCoverageNotes } from "@/features/governance/components/GovernanceCoverageNotes";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

import styles from "@/features/governance/GovernanceWorkspace.module.css";

type Props = {
  selectedDetail: GovernanceViewModel["selectedDetail"];
  chainId: number;
  loading?: boolean;
  onOpenHref?: (href: string) => void;
  labels: {
    title: string;
    empty: string;
    loading: string;
    actionSummary: string;
    transaction: string;
    protocolSurface: string;
    tokenMovements: string;
    valueEffect: string;
    epochContext: string;
    poolContext: string;
    classificationEvidence: string;
    linkedContexts: string;
    coverageNotes: string;
    evidenceSources: string;
    txHash: string;
    occurredAt: string;
    coverage: string;
    confidence: string;
    affectsTotals: string;
    reasonCodes: string;
    noMovements: string;
    noLinkedContexts: string;
    noEvidenceSources: string;
    amount: string;
    valueUsd: string;
    open: string;
    yes: string;
    no: string;
    unavailable: string;
    getActionLabel: (key: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getReason: (value: string) => string;
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

function shortHash(value: string | null, unavailable: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : unavailable;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function recordLabel(record: Record<string, unknown> | null, unavailable: string) {
  if (!record) return unavailable;
  const explicit = record.label;
  if (typeof explicit === "string" && explicit.trim().length > 0) return explicit;
  const id = record.epochId ?? record.poolId ?? record.id;
  return typeof id === "string" ? id : unavailable;
}

function sourceEvidenceLabel(record: Record<string, unknown>) {
  return asString(record.provider) ??
    asString(record.recordKind) ??
    asString(record.endpoint) ??
    asString(record.referenceId) ??
    "evidence";
}

function movementKey(record: Record<string, unknown>, index: number) {
  return [
    asString(record.id),
    asString(record.tokenAddress),
    asString(record.tokenSymbol),
    asString(record.amount),
    asString(record.amountRaw),
    index,
  ].filter(Boolean).join(":");
}

export function SelectedGovernanceRail({ selectedDetail, chainId, loading = false, labels, onOpenHref }: Props) {
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

              <CabSeparator />
              <CabText variant="heading" fontSize={13}>{labels.transaction}</CabText>
              <CabKeyValueList
                items={[
                  {
                    key: "tx",
                    label: labels.txHash,
                    value: selectedDetail.transaction.txHash ? (
                      <CabTxHash hash={selectedDetail.transaction.txHash} href={selectedDetail.transaction.externalTxUrl} />
                    ) : shortHash(null, labels.unavailable),
                  },
                  { key: "time", label: labels.occurredAt, value: labels.formatDateTime(selectedDetail.transaction.occurredAt), valueVariant: "mono" },
                  { key: "surface", label: labels.protocolSurface, value: labels.getSurface(selectedDetail.protocolSurface), valueVariant: "mono" },
                ]}
              />

              <CabSeparator />
              <CabText variant="heading" fontSize={13}>{labels.tokenMovements}</CabText>
              {selectedDetail.tokenMovements.length > 0 ? (
                <CabStack gap="$2">
                  {selectedDetail.tokenMovements.map((movement, index) => {
                    const tokenAddress = asString(movement.tokenAddress);
                    const tokenSymbol = asString(movement.tokenSymbol) ?? asString(movement.symbol);
                    const amount = asString(movement.amount) ?? asString(movement.amountRaw);
                    const amountUsd = asString(movement.amountUsd) ?? asString(movement.valueUsd);
                    return (
                      <CabStack key={movementKey(movement, index)} row alignItems="center" justifyContent="space-between" gap="$3">
                        <CabStack row alignItems="center" gap="$2" minWidth={0}>
                          <CabTokenIcon
                            chainId={chainId}
                            tokenAddress={tokenAddress}
                            symbol={tokenSymbol}
                            size="sm"
                            decorative
                          />
                          <CabStack gap="$1" minWidth={0}>
                            <CabText variant="body" fontSize={12}>{tokenSymbol ?? tokenAddress ?? labels.unavailable}</CabText>
                            <CabText variant="caption" color={cabColors.text.secondary}>{labels.amount}: {amount ?? labels.unavailable}</CabText>
                          </CabStack>
                        </CabStack>
                        <CabText variant="data" fontSize={12}>{labels.formatUsd(amountUsd)}</CabText>
                      </CabStack>
                    );
                  })}
                </CabStack>
              ) : (
                <CabText variant="caption" color={cabColors.text.secondary}>{labels.noMovements}</CabText>
              )}

              <CabSeparator />
              <CabText variant="heading" fontSize={13}>{labels.valueEffect}</CabText>
              <CabKeyValueList
                items={[
                  { key: "value", label: labels.valueEffect, value: labels.formatUsd(selectedDetail.valueEffect.valueUsd), valueVariant: "mono" },
                  { key: "valueCoverage", label: labels.coverage, value: labels.getCoverage(selectedDetail.valueEffect.coverageState), valueVariant: "mono" },
                  { key: "epoch", label: labels.epochContext, value: recordLabel(selectedDetail.epochContext, labels.unavailable), valueVariant: "mono" },
                  { key: "pool", label: labels.poolContext, value: recordLabel(selectedDetail.poolContext, labels.unavailable), valueVariant: "mono" },
                  { key: "confidence", label: labels.confidence, value: labels.getConfidence(selectedDetail.coverageNotes.confidence), valueVariant: "mono" },
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
              <CabText variant="caption" color={cabColors.text.secondary}>{labels.getReason(entry)}</CabText>
            </CabStack>
          ))}
          {selectedDetail.classificationEvidence.missingEvidenceReasonCodes.length > 0 ? (
            <CabStack gap="$1">
              {selectedDetail.classificationEvidence.missingEvidenceReasonCodes.map((entry) => (
                <CabStack key={entry} row alignItems="center" gap="$2">
                  <CabIcon name="warning" width={12} height={12} color={cabColors.semantic.warning} />
                  <CabText variant="caption" color={cabColors.text.secondary}>{labels.getReason(entry)}</CabText>
                </CabStack>
              ))}
            </CabStack>
          ) : null}
        </CabStack>
      </CabCard>

      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.linkedContexts}</CabText>
          {selectedDetail.linkedContexts.length > 0 ? (
            <CabStack gap="$2">
              {selectedDetail.linkedContexts.map((link) => (
                <a
                  key={`${link.kind}:${link.entityId}`}
                  href={link.route}
                  style={{ textDecoration: "none" }}
                  onClick={onOpenHref ? (event) => {
                    event.preventDefault();
                    onOpenHref(link.route);
                  } : undefined}
                >
                  <CabStack row alignItems="center" justifyContent="space-between" gap="$2">
                    <CabStack gap="$1">
                      <CabText variant="body" fontSize={12}>{link.kind}</CabText>
                      <CabText variant="mono" fontSize={11} color={cabColors.text.secondary}>{shortHash(link.entityId, labels.unavailable)}</CabText>
                    </CabStack>
                    <CabIcon name="externalLink" size="sm" tone="signal" />
                  </CabStack>
                </a>
              ))}
            </CabStack>
          ) : (
            <CabText variant="caption" color={cabColors.text.secondary}>{labels.noLinkedContexts}</CabText>
          )}
        </CabStack>
      </CabCard>

      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.coverageNotes}</CabText>
          <GovernanceCoverageNotes
            coverageNotes={selectedDetail.coverageNotes}
            labels={{
              coverage: labels.coverage,
              confidence: labels.confidence,
              affectsTotals: labels.affectsTotals,
              reasonCodes: labels.reasonCodes,
              yes: labels.yes,
              no: labels.no,
              getCoverage: labels.getCoverage,
              getConfidence: labels.getConfidence,
              getReason: labels.getReason,
            }}
          />
        </CabStack>
      </CabCard>

      <CabCard density="compact">
        <CabStack gap="$2">
          <CabText variant="label">{labels.evidenceSources}</CabText>
          {selectedDetail.sourceEvidenceRefs.length > 0 ? (
            <CabStack gap="$2">
              {selectedDetail.sourceEvidenceRefs.map((source, index) => (
                <CabStack key={`${sourceEvidenceLabel(source)}:${index}`} row alignItems="center" justifyContent="space-between" gap="$2">
                  <CabText variant="caption" color={cabColors.text.secondary}>{sourceEvidenceLabel(source)}</CabText>
                  <CabBadge tone="success" size="sm">{labels.getCoverage("full")}</CabBadge>
                </CabStack>
              ))}
            </CabStack>
          ) : (
            <CabText variant="caption" color={cabColors.text.secondary}>{labels.noEvidenceSources}</CabText>
          )}
        </CabStack>
      </CabCard>
    </CabStack>
  );
}
