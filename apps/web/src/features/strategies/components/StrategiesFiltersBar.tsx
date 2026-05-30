"use client";

import { CabButton, CabInput } from "@/design-system";
import type { StrategiesListUrlState } from "@/features/strategies/strategies.urlState";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategiesFiltersBarProps = {
  state: StrategiesListUrlState;
  labels: {
    searchPlaceholder: string;
    active: string;
    closed: string;
    all: string;
  };
  onSearchChange: (value: string) => void;
  onStatusChange: (status: StrategiesListUrlState["status"]) => void;
};

export function StrategiesFiltersBar({ state, labels, onSearchChange, onStatusChange }: StrategiesFiltersBarProps) {
  return (
    <div className={styles.filtersBar}>
      <CabInput
        value={state.search}
        placeholder={labels.searchPlaceholder}
        aria-label={labels.searchPlaceholder}
        onChangeText={onSearchChange}
        density="compact"
        className={styles.searchInput}
      />
      <div className={styles.segmented}>
        {(["active", "closed", "all"] as const).map((status) => (
          <CabButton
            key={status}
            tone={state.status === status ? "technical" : "secondary"}
            density="compact"
            onPress={() => onStatusChange(status)}
          >
            {labels[status]}
          </CabButton>
        ))}
      </div>
    </div>
  );
}

