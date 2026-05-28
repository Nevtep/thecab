"use client";

import { CabButton, CabFilterBar } from "@/design-system";
import type {
  DepositsReturnSignFilter,
  DepositsStatusFilter,
} from "@/features/deposits/deposits.types";

import styles from "@/features/deposits/components/DepositsFiltersBar.module.css";

type DepositsFiltersBarProps = {
  status: DepositsStatusFilter;
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
  };
  onStatusChange: (value: DepositsStatusFilter) => void;
  onReturnSignChange: (value: DepositsReturnSignFilter) => void;
};

export function DepositsFiltersBar({
  status,
  returnSign,
  labels,
  onStatusChange,
  onReturnSignChange,
}: DepositsFiltersBarProps) {
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
      </div>
    </CabFilterBar>
  );
}
