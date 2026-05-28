"use client";

import { CabEmptyState } from "@/design-system";

type DepositsEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function DepositsEmptyState({ title, description, actionLabel, onAction }: DepositsEmptyStateProps) {
  return (
    <CabEmptyState
      title={title}
      description={description}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
