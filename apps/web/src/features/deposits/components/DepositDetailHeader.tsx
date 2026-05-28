"use client";

import { CabBadge, CabButton, CabSectionHeader, CabStack, CabText } from "@/design-system";

type DepositDetailHeaderProps = {
  title: string;
  subtitle?: string;
  statusLabel: string;
  tokenIdLabel: string | null;
  explorerUrl: string | null;
  viewInExplorerLabel: string;
  closeLabel: string;
  onClose?: () => void;
};

export function DepositDetailHeader(input: DepositDetailHeaderProps) {
  return (
    <CabStack gap="$2">
      <CabSectionHeader
        title={input.title}
        subtitle={input.subtitle}
        actions={input.onClose ? (
          <CabButton tone="ghost" controlSize="sm" onPress={input.onClose}>
            {input.closeLabel}
          </CabButton>
        ) : undefined}
      />
      <CabStack row gap="$2" flexWrap="wrap" alignItems="center">
        <CabBadge tone="info">{input.statusLabel}</CabBadge>
        {input.tokenIdLabel ? <CabBadge tone="neutral">{input.tokenIdLabel}</CabBadge> : null}
        {input.explorerUrl ? (
          <CabButton
            tone="warning"
            controlSize="sm"
            onPress={() => {
              window.open(input.explorerUrl!, "_blank", "noopener,noreferrer");
            }}
          >
            {input.viewInExplorerLabel}
          </CabButton>
        ) : null}
      </CabStack>
      {input.subtitle ? <CabText variant="caption">{input.subtitle}</CabText> : null}
    </CabStack>
  );
}