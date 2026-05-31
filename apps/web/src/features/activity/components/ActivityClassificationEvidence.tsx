"use client";

import { CabBadge, CabKeyValueList, CabStack, CabText, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

type Props = {
  activity: NonNullable<ActivityViewModel["selectedActivity"]>;
  labels: {
    basis: string;
    metadata: string;
    reasonCodes: string;
    getAction: (value: string) => string;
    getSurface: (value: string) => string;
    getReason: (value: string) => string;
  };
};

function metadataBasis(metadata: Record<string, unknown>) {
  const basis = metadata.classificationBasis ?? metadata.basis ?? metadata.sourceSurface ?? metadata.surfaceKind;
  if (Array.isArray(basis)) return basis.filter((value): value is string => typeof value === "string");
  return typeof basis === "string" ? [basis] : [];
}

export function ActivityClassificationEvidence({ activity, labels }: Props) {
  const basis = metadataBasis(activity.metadata);

  return (
    <CabStack gap="$3">
      <CabKeyValueList
        items={[
          { key: "action", label: labels.getAction(activity.action), value: labels.getSurface(activity.surface), valueVariant: "mono" },
          { key: "basis", label: labels.basis, value: basis.length ? basis.join(", ") : labels.metadata, valueVariant: "mono" },
        ]}
      />
      {activity.reasonCodes.length ? (
        <CabStack row gap="$2" flexWrap="wrap">
          {activity.reasonCodes.map((reasonCode) => (
            <CabBadge key={reasonCode} tone="warning" size="sm">{labels.getReason(reasonCode)}</CabBadge>
          ))}
        </CabStack>
      ) : (
        <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
          {labels.reasonCodes}
        </CabText>
      )}
    </CabStack>
  );
}
