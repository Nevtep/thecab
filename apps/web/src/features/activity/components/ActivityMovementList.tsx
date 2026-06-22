"use client";

import { CabKeyValueList, CabStack, CabText, CabTokenIcon, cabColors } from "@/design-system";
import type { ActivityViewModel } from "@/features/activity/activity.types";

type Props = {
  chainId: number;
  movements: NonNullable<ActivityViewModel["selectedActivity"]>["movements"];
  labels: {
    empty: string;
    formatAmount: (value: string | null) => string;
    formatUsd: (value: string | null) => string;
  };
};

export function ActivityMovementList({ chainId, movements, labels }: Props) {
  if (movements.length === 0) {
    return (
      <CabText variant="body" fontSize={12} color={cabColors.text.secondary}>
        {labels.empty}
      </CabText>
    );
  }

  return (
    <CabKeyValueList
      items={movements.map((movement) => ({
        key: movement.id,
        label: movement.direction === "in" ? "+" : "-",
        value: (
          <CabStack row alignItems="center" justifyContent="flex-end" gap="$2">
            <CabTokenIcon
              chainId={chainId}
              tokenAddress={movement.tokenAddress}
              symbol={movement.tokenSymbol}
              size="sm"
              decorative
            />
            <CabStack gap="$1" alignItems="flex-end" minWidth={0}>
              <CabText variant="mono" fontSize={12}>
                {movement.tokenSymbol ?? movement.tokenAddress ?? ""} {movement.amountFormatted ?? labels.formatAmount(movement.amountRaw)}
              </CabText>
              {movement.amountUsd ? (
                <CabText variant="caption" fontSize={11} color={cabColors.text.secondary}>
                  {labels.formatUsd(movement.amountUsd)}
                </CabText>
              ) : null}
            </CabStack>
          </CabStack>
        ),
      }))}
    />
  );
}
