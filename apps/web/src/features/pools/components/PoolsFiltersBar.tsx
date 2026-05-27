"use client";

import { CabButton, CabFilterBar, CabInput, CabText } from "@/design-system";
import { cabColors } from "@/design-system/tokens";

import type { PoolsListFilters } from "@/features/pools/pools.types";

import styles from "@/features/pools/components/PoolsFiltersBar.module.css";

export function PoolsFiltersBar(input: {
  filters: PoolsListFilters;
  searchPlaceholder: string;
  labels: {
    all: string;
    active: string;
    closed: string;
    pools: string;
    totalValue: string;
    coveredRange: string;
  };
  summary: {
    poolCount: string;
    currentAttributedValueUsd: string;
    coveredRange: string | null;
  };
  onSearchChange: (value: string) => void;
  onStatusChange: (value: PoolsListFilters["status"]) => void;
}) {
  return (
    <CabFilterBar>
      <div className={styles.layout}>
        <div className={styles.controls}>
          <CabInput
            value={input.filters.search}
            onChangeText={input.onSearchChange}
            placeholder={input.searchPlaceholder}
            width="min(100%, 220px)"
          />
          {([
            ["all", input.labels.all],
            ["active", input.labels.active],
            ["closed", input.labels.closed],
          ] as const).map(([status, label]) => (
            <CabButton
              key={status}
              tone={input.filters.status === status ? "primary" : "secondary"}
              onPress={() => input.onStatusChange(status)}
            >
              {label}
            </CabButton>
          ))}
        </div>
        <div className={styles.summaryGrid}>
          {[
            { label: input.labels.pools, value: input.summary.poolCount },
            { label: input.labels.totalValue, value: input.summary.currentAttributedValueUsd },
            { label: input.labels.coveredRange, value: input.summary.coveredRange },
          ].filter((item): item is { label: string; value: string } => typeof item.value === "string" && item.value.length > 0).map((item) => (
            <div
              key={item.label}
              className={styles.summaryCard}
              style={{
                border: `1px solid ${cabColors.surface.border}`,
                background: "rgba(15, 24, 38, 0.58)",
              }}
            >
              <CabText variant="caption" className={styles.summaryLabel} color={cabColors.text.secondary}>
                {item.label}
              </CabText>
              <CabText variant="label" className={styles.summaryValue} color={cabColors.text.primary}>
                {item.value}
              </CabText>
            </div>
          ))}
        </div>
      </div>
    </CabFilterBar>
  );
}