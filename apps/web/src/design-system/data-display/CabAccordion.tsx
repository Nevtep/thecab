"use client";

import type { ReactNode } from "react";
import { Accordion } from "tamagui";

import { CabIcon } from "@/design-system/icons/CabIcon";
import { CabStack } from "@/design-system/primitives/CabStack";
import { cabColors } from "@/design-system/tokens";
import type { CabDensity } from "@/design-system/tokens";

const densityPaddingMap: Record<CabDensity, string> = {
  compact: "$2",
  default: "$3",
  spacious: "$4",
};

export type CabAccordionItem = {
  value: string;
  header: ReactNode;
  content: ReactNode;
};

export type CabAccordionProps = {
  items: CabAccordionItem[];
  density?: CabDensity;
  defaultExpandedValues?: string[];
};

export function CabAccordion({
  items,
  density = "default",
  defaultExpandedValues = [],
}: CabAccordionProps) {
  const padding = densityPaddingMap[density];

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultExpandedValues}
      width="100%"
      overflow="hidden"
      borderColor={cabColors.surface.border}
      borderWidth={1}
      borderRadius="$3"
    >
      {items.map((item, index) => (
        <Accordion.Item
          key={item.value}
          value={item.value}
          borderTopWidth={index === 0 ? 0 : 1}
          borderColor={cabColors.surface.border}
        >
          <Accordion.Header>
            <Accordion.Trigger
              width="100%"
              backgroundColor="transparent"
              borderWidth={0}
              padding={padding}
              pressStyle={{ opacity: 0.9 }}
            >
              <CabStack row justifyContent="space-between" alignItems="center" gap="$3" width="100%">
                <CabStack flex={1}>{item.header}</CabStack>
                <CabIcon name="chevronDown" tone="muted" size="sm" />
              </CabStack>
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.HeightAnimator>
            <Accordion.Content paddingHorizontal={padding} paddingBottom={padding} paddingTop="$0">
              {item.content}
            </Accordion.Content>
          </Accordion.HeightAnimator>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}