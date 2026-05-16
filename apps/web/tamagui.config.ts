import { createFont, createTamagui, createTokens } from "@tamagui/core";

import { tamaguiColorTokens } from "@/design-system/tokens/tamaguiColorTokens";

const interFont = createFont({
  family: "var(--cab-font-ui), Inter, system-ui, -apple-system, sans-serif",
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 15,
    5: 17,
    6: 20,
    7: 24,
    8: 30,
    true: 15,
  },
  lineHeight: {
    1: 14,
    2: 16,
    3: 18,
    4: 21,
    5: 24,
    6: 28,
    7: 32,
    8: 38,
    true: 21,
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
    7: "700",
  },
});

const orbitronFont = createFont({
  family: "var(--cab-font-display), Orbitron, sans-serif",
  size: {
    1: 12,
    2: 13,
    3: 15,
    4: 17,
    5: 20,
    6: 24,
    7: 30,
    8: 36,
    true: 17,
  },
  lineHeight: {
    1: 16,
    2: 18,
    3: 20,
    4: 23,
    5: 27,
    6: 31,
    7: 37,
    8: 44,
    true: 23,
  },
  weight: {
    5: "500",
    6: "600",
    7: "700",
  },
});

const monoFont = createFont({
  family: "var(--cab-font-data), 'IBM Plex Mono', ui-monospace, monospace",
  size: {
    1: 10,
    2: 11,
    3: 12,
    4: 13,
    5: 14,
    6: 16,
    true: 12,
  },
  lineHeight: {
    1: 13,
    2: 14,
    3: 16,
    4: 18,
    5: 19,
    6: 22,
    true: 16,
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
  },
});

const tokens = createTokens({
  color: { ...tamaguiColorTokens },
  size: {
    0: 0,
    1: 8,
    2: 12,
    3: 16,
    4: 20,
    5: 24,
    6: 32,
    7: 40,
    8: 48,
    true: 16,
  },
  space: {
    0: 0,
    1: 8,
    2: 12,
    3: 16,
    4: 20,
    5: 24,
    6: 32,
    true: 16,
  },
  radius: {
    xs: 2,
    sm: 4,
    md: 6,
    lg: 10,
    panel: 12,
    xl: 16,
    pill: 999,
    0: 0,
    1: 4,
    2: 6,
    3: 10,
    4: 12,
    5: 16,
    true: 6,
  },
  zIndex: {
    0: 0,
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    true: 1,
  },
});

const config = createTamagui({
  tokens,
  fonts: {
    body: interFont,
    heading: orbitronFont,
    mono: monoFont,
  },
  themes: {
    dark: {
      background: tokens.color.background,
      color: tokens.color.foreground,
      borderColor: tokens.color.border,
      accentColor: tokens.color.accent,
    },
  },
  defaultTheme: "dark",
  defaultFont: "body",
});

export type AppTamaguiConfig = typeof config;

declare module "@tamagui/core" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config;
