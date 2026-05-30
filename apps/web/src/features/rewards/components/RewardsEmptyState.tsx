"use client";

import { CabEmptyState } from "@/design-system";

type Props = {
  title: string;
  description: string;
};

export function RewardsEmptyState({ title, description }: Props) {
  return <CabEmptyState title={title} description={description} />;
}
