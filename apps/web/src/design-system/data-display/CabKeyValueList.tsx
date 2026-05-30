"use client";

import type { ReactNode } from "react";

import { CabStack } from "@/design-system/primitives/CabStack";
import { CabText } from "@/design-system/primitives/CabText";
import { cabColors } from "@/design-system/tokens";

export type CabKeyValueItem = {
  key: string;
  label: string;
  value: ReactNode;
  valueAlign?: "start" | "end";
  valueVariant?: "body" | "mono";
};

export function CabKeyValueList({ items }: { items: CabKeyValueItem[] }) {
  return (
    <CabStack gap="$2">
      {items.map((item) => (
        <CabStack
          key={item.key}
          row
          justifyContent="space-between"
          alignItems="flex-start"
          gap="$3"
        >
          <CabText variant="caption" fontSize={12} color={cabColors.text.secondary}>
            {item.label}
          </CabText>
          {typeof item.value === "string" || typeof item.value === "number" ? (
            <CabText
              variant={item.valueVariant ?? "body"}
              fontSize={12}
              textAlign={item.valueAlign === "start" ? "left" : "right"}
              flex={1}
              minWidth={0}
            >
              {item.value}
            </CabText>
          ) : (
            <CabStack row justifyContent={item.valueAlign === "start" ? "flex-start" : "flex-end"} flex={1} minWidth={0}>
              {item.value}
            </CabStack>
          )}
        </CabStack>
      ))}
    </CabStack>
  );
}
