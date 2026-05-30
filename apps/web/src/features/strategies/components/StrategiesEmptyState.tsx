"use client";

import { CabEmptyState } from "@/design-system";

export function StrategiesEmptyState({ title, description }: { title: string; description: string }) {
  return <CabEmptyState title={title} description={description} />;
}

