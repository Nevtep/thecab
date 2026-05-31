"use client";

import { CabBadge, CabStack, CabText, cabColors } from "@/design-system";
import type { GovernanceViewModel } from "@/features/governance/governance.types";

type Props = {
  coverageNotes: GovernanceViewModel["selectedDetail"]["coverageNotes"];
  labels: {
    coverage: string;
    confidence: string;
    affectsTotals: string;
    reasonCodes: string;
    yes: string;
    no: string;
    getCoverage: (value: string) => string;
    getConfidence: (value: string) => string;
    getReason: (value: string) => string;
  };
};

function coverageTone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "excluded" || coverage === "unsupported" || coverage === "unresolved") return "danger";
  return "neutral";
}

export function GovernanceCoverageNotes({ coverageNotes, labels }: Props) {
  return (
    <CabStack gap="$2">
      <CabStack row gap="$2" flexWrap="wrap">
        <CabBadge tone={coverageTone(coverageNotes.coverageState)} size="sm">
          {labels.getCoverage(coverageNotes.coverageState)}
        </CabBadge>
        <CabBadge tone="info" size="sm" variant="emphasis">
          {labels.getConfidence(coverageNotes.confidence)}
        </CabBadge>
      </CabStack>
      <CabStack gap="$1">
        <CabText variant="caption" color={cabColors.text.secondary}>
          {labels.affectsTotals}: {coverageNotes.affectsTotals ? labels.yes : labels.no}
        </CabText>
        <CabText variant="caption" color={cabColors.text.secondary}>
          {labels.coverage}: {labels.getCoverage(coverageNotes.coverageState)} · {labels.confidence}: {labels.getConfidence(coverageNotes.confidence)}
        </CabText>
      </CabStack>
      {coverageNotes.reasonCodes.length > 0 ? (
        <CabStack gap="$1">
          <CabText variant="caption" color={cabColors.text.muted}>{labels.reasonCodes}</CabText>
          {coverageNotes.reasonCodes.map((reason) => (
            <CabText key={reason} variant="caption" color={cabColors.text.secondary}>
              {labels.getReason(reason)}
            </CabText>
          ))}
        </CabStack>
      ) : null}
    </CabStack>
  );
}
