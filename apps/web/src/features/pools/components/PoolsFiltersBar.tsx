"use client";

import { CabButton, CabFilterBar, CabInput } from "@/design-system";

import type { PoolsListFilters } from "@/features/pools/pools.types";

import styles from "@/features/pools/components/PoolsFiltersBar.module.css";

export function PoolsFiltersBar(input: {
  filters: PoolsListFilters;
  searchPlaceholder: string;
  labels: {
    all: string;
    active: string;
    closed: string;
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
            width="min(100%, 240px)"
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
      </div>
    </CabFilterBar>
  );
}
