"use client";

import { CabAccordion, CabButton, CabFilterBar, CabInput } from "@/design-system";
import { CabText } from "@/design-system/primitives/CabText";
import type {
  DepositsReturnSignFilter,
  DepositsStatusFilter,
} from "@/features/deposits/deposits.types";

import styles from "@/features/deposits/components/DepositsFiltersBar.module.css";

type DepositsFiltersBarProps = {
  status: DepositsStatusFilter;
  poolId: string | null;
  startDayUtc: string | null;
  endDayUtc: string | null;
  returnSign: DepositsReturnSignFilter;
  labels: {
    status: {
      label: string;
      all: string;
      open_active: string;
      open_out_of_range: string;
      closed: string;
    };
    returnSign: {
      label: string;
      all: string;
      positive: string;
      negative: string;
    };
    pool: {
      label: string;
      active: string;
      clear: string;
      all: string;
    };
    dateRange: {
      label: string;
      start: string;
      end: string;
      clear: string;
    };
    more: {
      label: string;
    };
  };
  onStatusChange: (value: DepositsStatusFilter) => void;
  onClearPool: () => void;
  onStartDayChange: (value: string | null) => void;
  onEndDayChange: (value: string | null) => void;
  onClearDateRange: () => void;
  onReturnSignChange: (value: DepositsReturnSignFilter) => void;
};

export function DepositsFiltersBar({
  status,
  poolId,
  startDayUtc,
  endDayUtc,
  returnSign,
  labels,
  onStatusChange,
  onClearPool,
  onStartDayChange,
  onEndDayChange,
  onClearDateRange,
  onReturnSignChange,
}: DepositsFiltersBarProps) {
  const compactPoolId = poolId ? `${poolId.slice(0, 6)}…${poolId.slice(-4)}` : null;

  return (
    <CabFilterBar>
      <div className={styles.layout}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>{labels.status.label}</span>
          {(
            [
              ["all", labels.status.all],
              ["open_active", labels.status.open_active],
              ["open_out_of_range", labels.status.open_out_of_range],
              ["closed", labels.status.closed],
            ] as const
          ).map(([value, label]) => (
            <CabButton
              key={value}
              tone={status === value ? "primary" : "secondary"}
              onPress={() => onStatusChange(value)}
            >
              {label}
            </CabButton>
          ))}
        </div>
        <div className={styles.group}>
          <span className={styles.groupLabel}>{labels.pool.label}</span>
          {compactPoolId ? (
            <>
              <CabButton tone="primary" onPress={onClearPool}>
                {labels.pool.active}: {compactPoolId}
              </CabButton>
              <CabButton tone="secondary" onPress={onClearPool}>
                {labels.pool.clear}
              </CabButton>
            </>
          ) : (
            <CabText variant="caption">{labels.pool.all}</CabText>
          )}
        </div>
        <div className={styles.group}>
          <span className={styles.groupLabel}>{labels.dateRange.label}</span>
          <CabInput
            type="date"
            value={startDayUtc ?? ""}
            onChangeText={(value) => onStartDayChange(value.trim().length > 0 ? value : null)}
            aria-label={labels.dateRange.start}
            width="min(100%, 180px)"
          />
          <CabInput
            type="date"
            value={endDayUtc ?? ""}
            onChangeText={(value) => onEndDayChange(value.trim().length > 0 ? value : null)}
            aria-label={labels.dateRange.end}
            width="min(100%, 180px)"
          />
          {(startDayUtc || endDayUtc) ? (
            <CabButton tone="secondary" onPress={onClearDateRange}>
              {labels.dateRange.clear}
            </CabButton>
          ) : null}
        </div>
        <div className={styles.group}>
          <CabAccordion
            items={[
              {
                value: "more-filters",
                header: <CabText variant="label">{labels.more.label}</CabText>,
                content: (
                  <div className={styles.group}>
                    <span className={styles.groupLabel}>{labels.returnSign.label}</span>
                    {(
                      [
                        ["all", labels.returnSign.all],
                        ["positive", labels.returnSign.positive],
                        ["negative", labels.returnSign.negative],
                      ] as const
                    ).map(([value, label]) => (
                      <CabButton
                        key={value}
                        tone={returnSign === value ? "primary" : "secondary"}
                        onPress={() => onReturnSignChange(value)}
                      >
                        {label}
                      </CabButton>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </CabFilterBar>
  );
}
