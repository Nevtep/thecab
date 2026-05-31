"use client";

import { CabBadge, CabStack, CabText, CabTooltip } from "@/design-system";
import type { DepositSummaryRowViewModel } from "@/features/deposits/deposits.mappers";
import { formatPercentPoints } from "@/i18n/formatters";

type PositionLabelCellProps = {
  row: Pick<
    DepositSummaryRowViewModel,
    | "positionLabel"
    | "tokenId"
    | "feeTierBps"
    | "poolKind"
    | "openedByTransferIn"
  >;
  locale: string;
  transferInLabel: string;
  transferInTooltip: string;
};

function formatFeeTier(bps: number | null, locale: string) {
  if (bps === null) return null;
  const pct = bps / 10000;
  return formatPercentPoints(pct, locale);
}

export function PositionLabelCell({ row, locale, transferInLabel, transferInTooltip }: PositionLabelCellProps) {
  const feeTier = formatFeeTier(row.feeTierBps, locale);
  const idLabel = row.tokenId ? `#${row.tokenId}` : null;
  const secondary = [idLabel, feeTier].filter(Boolean).join(" · ");

  return (
    <CabStack gap="$1">
      <CabStack row gap="$2" alignItems="center">
        <CabText variant="label">{row.positionLabel}</CabText>
        {row.openedByTransferIn ? (
          <CabTooltip label={transferInTooltip}>
            <CabBadge tone="warning">{transferInLabel}</CabBadge>
          </CabTooltip>
        ) : null}
      </CabStack>
      {secondary ? (
        <CabText variant="caption" opacity={0.7}>
          {secondary}
        </CabText>
      ) : null}
    </CabStack>
  );
}
