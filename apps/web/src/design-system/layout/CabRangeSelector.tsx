"use client";

import { CabButton } from "@/design-system/primitives/CabButton";
import { CabStack } from "@/design-system/primitives/CabStack";

export type CabRangeSelectorOption = {
  key: string;
  label: string;
};

export type CabRangeSelectorProps = {
  options: CabRangeSelectorOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
};

export function CabRangeSelector({ options, selectedKey, onSelect }: CabRangeSelectorProps) {
  return (
    <CabStack row gap="$2" flexWrap="wrap">
      {options.map((option) => (
        <CabButton
          key={option.key}
          tone={selectedKey === option.key ? "primary" : "secondary"}
          controlSize="md"
          onPress={() => onSelect(option.key)}
        >
          {option.label}
        </CabButton>
      ))}
    </CabStack>
  );
}
