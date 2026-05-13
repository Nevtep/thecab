import { createTamagui, createTokens } from "@tamagui/core";

const tokens = createTokens({
  color: {
    background: "#040F1C",
    deepSpace: "#0F1826",
    controlBlue: "#15233A",
    surface: "#111A27",
    surfaceElevated: "#1A2233",
    border: "#2A3347",
    foreground: "#EAF1FF",
    secondary: "#B8C7E6",
    muted: "#6B7A98",
    accent: "#00E0E1",
    electricBlue: "#3B82F6",
    gold: "#F2C14E",
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#EF4444",
    info: "#38BDF8",
  },
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
    0: 0,
    1: 6,
    2: 10,
    3: 14,
    4: 18,
    true: 10,
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
  themes: {
    dark: {
      background: tokens.color.background,
      color: tokens.color.foreground,
      borderColor: tokens.color.border,
      accentColor: tokens.color.accent,
    },
  },
  defaultTheme: "dark",
});

export type AppTamaguiConfig = typeof config;

declare module "@tamagui/core" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends AppTamaguiConfig {}
}

export default config;
