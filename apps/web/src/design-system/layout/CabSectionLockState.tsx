"use client";

import { CabBadge } from "@/design-system/primitives/CabBadge";

export type CabSectionLockStateProps = {
  locked: boolean;
  label: string;
};

export function CabSectionLockState({ locked, label }: CabSectionLockStateProps) {
  return <CabBadge tone={locked ? "warning" : "success"}>{label}</CabBadge>;
}
