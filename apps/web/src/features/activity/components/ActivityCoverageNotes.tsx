"use client";

import { CabBadge, CabKeyValueList, CabStack } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

type Props = {
  activity: NonNullable<ActivityViewModel["selectedActivity"]>;
  labels: {
    coverage: string;
    affectsTotals: string;
    reasonCodes: string;
    yes: string;
    no: string;
    getCoverage: (value: string) => string;
    getReason: (value: string) => string;
  };
};

function affectsTotals(activity: NonNullable<ActivityViewModel["selectedActivity"]>) {
  return activity.coverage !== "excluded" && activity.coverage !== "unavailable" && activity.coverage !== "unresolved";
}

function tone(coverage: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (coverage === "full") return "success";
  if (coverage === "partial") return "warning";
  if (coverage === "excluded" || coverage === "unresolved" || coverage === "unavailable") return "danger";
  return "neutral";
}

export function ActivityCoverageNotes({ activity, labels }: Props) {
  return (
    <CabStack gap="$3">
      <CabKeyValueList
        items={[
          {
            key: "coverage",
            label: labels.coverage,
            value: <CabBadge tone={tone(activity.coverage)} size="sm">{labels.getCoverage(activity.coverage)}</CabBadge>,
          },
          {
            key: "affectsTotals",
            label: labels.affectsTotals,
            value: affectsTotals(activity) ? labels.yes : labels.no,
          },
        ]}
      />
      {activity.reasonCodes.length ? (
        <CabStack row gap="$2" flexWrap="wrap">
          {activity.reasonCodes.map((reasonCode) => (
            <CabBadge key={reasonCode} tone="warning" size="sm">{labels.getReason(reasonCode)}</CabBadge>
          ))}
        </CabStack>
      ) : null}
    </CabStack>
  );
}
