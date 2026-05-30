"use client";

import { CabButton, CabFilterBar, CabInput, CabText } from "@/design-system";
import type { StrategiesListUrlState } from "@/features/strategies/strategies.urlState";

import styles from "@/features/strategies/StrategiesWorkspace.module.css";

type StrategiesFiltersBarProps = {
  state: StrategiesListUrlState;
  availablePools: Array<{ poolId: string; label: string }>;
  labels: {
    searchPlaceholder: string;
    status: string;
    protocol: string;
    pool: string;
    coverage: string;
    returnSign: string;
    sort: string;
    active: string;
    closed: string;
    all: string;
    mellow: string;
    full: string;
    shareLevel: string;
    partial: string;
    unknown: string;
    positive: string;
    negative: string;
    any: string;
    currentValueDesc: string;
    currentValueAsc: string;
    returnDesc: string;
    returnAsc: string;
    coverageDesc: string;
    coverageAsc: string;
    clearPool: string;
    clearFilters: string;
  };
  onSearchChange: (value: string) => void;
  onStatusChange: (status: StrategiesListUrlState["status"]) => void;
  onProtocolChange: (protocol: StrategiesListUrlState["protocol"]) => void;
  onCoverageChange: (coverage: StrategiesListUrlState["coverage"]) => void;
  onReturnSignChange: (returnSign: StrategiesListUrlState["returnSign"]) => void;
  onSortChange: (sort: StrategiesListUrlState["sort"]) => void;
  onClearPool: () => void;
  onClearFilters: () => void;
};

export function StrategiesFiltersBar({
  availablePools,
  state,
  labels,
  onSearchChange,
  onStatusChange,
  onProtocolChange,
  onCoverageChange,
  onReturnSignChange,
  onSortChange,
  onClearPool,
  onClearFilters,
}: StrategiesFiltersBarProps) {
  const activePool = state.poolId ? availablePools.find((pool) => pool.poolId === state.poolId) : null;

  return (
    <CabFilterBar>
      <div className={styles.filtersBar}>
        <CabInput
          value={state.search}
          placeholder={labels.searchPlaceholder}
          aria-label={labels.searchPlaceholder}
          onChangeText={onSearchChange}
          density="compact"
          className={styles.searchInput}
        />
        <div className={styles.filterGroup}>
          <CabText variant="caption">{labels.status}</CabText>
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
        <div className={styles.filterGroup}>
          <CabText variant="caption">{labels.protocol}</CabText>
          <div className={styles.segmented}>
            {(["mellow", "all"] as const).map((protocol) => (
              <CabButton
                key={protocol}
                tone={state.protocol === protocol ? "technical" : "secondary"}
                density="compact"
                onPress={() => onProtocolChange(protocol)}
              >
                {protocol === "mellow" ? labels.mellow : labels.all}
              </CabButton>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <CabText variant="caption">{labels.coverage}</CabText>
          <div className={styles.segmented}>
            {([
              ["all", labels.all],
              ["full", labels.full],
              ["share_level", labels.shareLevel],
              ["partial", labels.partial],
              ["unknown", labels.unknown],
            ] as const).map(([coverage, label]) => (
              <CabButton
                key={coverage}
                tone={state.coverage === coverage ? "technical" : "secondary"}
                density="compact"
                onPress={() => onCoverageChange(coverage)}
              >
                {label}
              </CabButton>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <CabText variant="caption">{labels.returnSign}</CabText>
          <div className={styles.segmented}>
            {([
              ["any", labels.any],
              ["positive", labels.positive],
              ["negative", labels.negative],
            ] as const).map(([returnSign, label]) => (
              <CabButton
                key={returnSign}
                tone={state.returnSign === returnSign ? "technical" : "secondary"}
                density="compact"
                onPress={() => onReturnSignChange(returnSign)}
              >
                {label}
              </CabButton>
            ))}
          </div>
        </div>
        <div className={styles.filterGroup}>
          <CabText variant="caption">{labels.sort}</CabText>
          <div className={styles.segmented}>
            {([
              ["current_value_desc", labels.currentValueDesc],
              ["current_value_asc", labels.currentValueAsc],
              ["return_desc", labels.returnDesc],
              ["return_asc", labels.returnAsc],
              ["coverage_desc", labels.coverageDesc],
              ["coverage_asc", labels.coverageAsc],
            ] as const).map(([sort, label]) => (
              <CabButton
                key={sort}
                tone={state.sort === sort ? "technical" : "secondary"}
                density="compact"
                onPress={() => onSortChange(sort)}
              >
                {label}
              </CabButton>
            ))}
          </div>
        </div>
        {state.poolId ? (
          <div className={styles.filterGroup}>
            <CabText variant="caption">{labels.pool}</CabText>
            <CabButton tone="technical" density="compact" onPress={onClearPool}>
              {activePool?.label ?? state.poolId}
            </CabButton>
            <CabButton tone="secondary" density="compact" onPress={onClearPool}>
              {labels.clearPool}
            </CabButton>
          </div>
        ) : null}
        <CabButton tone="secondary" density="compact" onPress={onClearFilters}>
          {labels.clearFilters}
        </CabButton>
      </div>
    </CabFilterBar>
  );
}
