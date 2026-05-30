"use client";

import { CabBadge, CabCard, CabStack, CabText } from "@/design-system";
import { getStrategyCoverageTone } from "@/features/strategies/strategies.mappers";
import type { StrategyDetailView } from "@/features/strategies/strategies.types";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategyCoverageNoteProps = {
  note: StrategyDetailView["coverageNote"];
  label: string;
  translate: (key: string, options?: { defaultValue?: string }) => string;
};

export function StrategyCoverageNote({ label, note, translate }: StrategyCoverageNoteProps) {
  const tone = getStrategyCoverageTone(note.status);
  const noteClass = note.status === "full"
    ? styles.coverageNote
    : note.status === "unknown"
      ? styles.coverageNoteCritical
      : styles.coverageNoteProminent;

  return (
    <CabCard density="compact">
      <div className={noteClass} data-coverage-status={note.status}>
        <CabStack gap="$2">
          <CabStack row gap="$2" alignItems="center" flexWrap="wrap">
            <CabText variant="label">{label}</CabText>
            <CabBadge tone={tone} size="sm">
              {translate(`coverage:level.${note.status}`)}
            </CabBadge>
          </CabStack>
          <CabText variant="heading">{translate(note.titleKey)}</CabText>
          <CabText variant="caption">{translate(note.bodyKey)}</CabText>
          {note.reasonCodes.length > 0 ? (
            <div className={styles.reasonList}>
              {note.reasonCodes.map((reason) => (
                <CabBadge key={reason} tone={tone === "success" ? "info" : tone} size="sm">
                  {translate(`coverage:reasons.${reason}`, { defaultValue: reason })}
                </CabBadge>
              ))}
            </div>
          ) : null}
        </CabStack>
      </div>
    </CabCard>
  );
}
