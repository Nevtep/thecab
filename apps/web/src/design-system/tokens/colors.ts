export const cabColors = {
  brand: {
    cabNight: "#040F1C",
    deepSpace: "#0F1826",
    controlBlue: "#15233A",
    signalTeal: "#00E0E1",
    electricBlue: "#3B82F6",
    cabGold: "#F2C14E",
  },
  surface: {
    darkSurface: "#111A27",
    elevatedSurface: "#1A2233",
    border: "#2A3347",
  },
  text: {
    primary: "#EAF1FF",
    secondary: "#B8C7E6",
    muted: "#6B7A98",
  },
  semantic: {
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#EF4444",
    info: "#38BDF8",
  },
} as const;

export type CabColorPalette = typeof cabColors;
