"use client";

import { CabBadge, CabCard, CabKeyValueList, CabLoadingPanel, CabSeparator, CabStack, CabText, CabTokenIcon, CabTxHash, cabColors } from "@/design-system";
import { ActivityClassificationEvidence } from "@/features/activity/components/ActivityClassificationEvidence";
import { ActivityCoverageNotes } from "@/features/activity/components/ActivityCoverageNotes";
import { ActivityLinkedEntities } from "@/features/activity/components/ActivityLinkedEntities";
import { ActivityMovementList } from "@/features/activity/components/ActivityMovementList";
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
    linkedEntities: string;
    classificationEvidence: string;
    coverageNotes: string;
    reasonCodes: string;
    noMovements: string;
    noLinkedEntities: string;
    classificationBasis: string;
    classificationMetadata: string;
    noReasonCodes: string;
    affectsTotals: string;
    yes: string;
    no: string;
    open: string;
    getAction: (value: string) => string;
    getSurface: (value: string) => string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getReason: (value: string) => string;
    getEntityKind: (value: string) => string;
    formatDateTime: (value: string) => string;
    formatAmount: (value: string | null) => string;
    formatUsd: (value: string | null) => string;
  };
  onOpenHref?: (href: string) => void;
};

function coverageTone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "excluded" || coverage === "unresolved" || coverage === "unavailable") return "danger";
  return "neutral";
}

export function SelectedActivityRail({ selectedActivity, loading = false, labels, onOpenHref }: Props) {
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
    <CabCard className={styles.rail} density="compact">
      <CabStack gap="$3">
        <CabStack row alignItems="center" justifyContent="space-between" gap="$3">
          <CabStack row alignItems="center" gap="$2" minWidth={0}>
            <CabTokenIcon
              chainId={selectedActivity.chainId}
              tokenAddress={selectedActivity.primaryTokenAddress}
              symbol={selectedActivity.primaryTokenSymbol}
              size="md"
              decorative
            />
            <CabStack gap="$1" minWidth={0}>
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

        <CabSeparator />
        <CabText variant="heading" fontSize={13}>{labels.movements}</CabText>
        <ActivityMovementList
          chainId={selectedActivity.chainId}
          movements={selectedActivity.movements}
          labels={{
            empty: labels.noMovements,
            formatAmount: labels.formatAmount,
            formatUsd: labels.formatUsd,
          }}
        />

        <CabSeparator />
        <CabText variant="heading" fontSize={13}>{labels.linkedEntities}</CabText>
        <ActivityLinkedEntities
          linkedEntities={selectedActivity.linkedEntities}
          labels={{
            empty: labels.noLinkedEntities,
            getKind: labels.getEntityKind,
            getReason: labels.getReason,
            open: labels.open,
          }}
          onOpenHref={onOpenHref}
        />

        <CabSeparator />
        <CabText variant="heading" fontSize={13}>{labels.classificationEvidence}</CabText>
        <ActivityClassificationEvidence
          activity={selectedActivity}
          labels={{
            basis: labels.classificationBasis,
            metadata: labels.classificationMetadata,
            reasonCodes: labels.noReasonCodes,
            getAction: labels.getAction,
            getSurface: labels.getSurface,
            getReason: labels.getReason,
          }}
        />

        <CabSeparator />
        <CabText variant="heading" fontSize={13}>{labels.coverageNotes}</CabText>
        <ActivityCoverageNotes
          activity={selectedActivity}
          labels={{
            coverage: labels.coverage,
            affectsTotals: labels.affectsTotals,
            reasonCodes: labels.reasonCodes,
            yes: labels.yes,
            no: labels.no,
            getCoverage: labels.getCoverage,
            getReason: labels.getReason,
          }}
        />
      </CabStack>
    </CabCard>
  );
}
