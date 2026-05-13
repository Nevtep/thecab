export const cabSpacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export const cabComponentPadding = {
  controlX: 12,
  controlY: 8,
  card: 16,
  panel: 20,
} as const;

export const cabDensity = {
  compact: "compact",
  default: "default",
  spacious: "spacious",
} as const;

export type CabDensity = keyof typeof cabDensity;
