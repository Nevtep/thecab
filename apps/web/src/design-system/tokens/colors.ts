export const cabColors = {
  brand: {
    cabNight: "#040F1C",
    deepSpace: "#0F1826",
    controlBlue: "#15233A",
    signalTeal: "#00E0E1",
    electricBlue: "#3B82F6",
    cabGold: "#F2C14E",
  },
  brandExtended: {
    signalTealRaw: "#00E0E1",
    signalTealUi: "#2EC5C9",
    signalTealMuted: "#1A8F98",
    signalTealGlow: "rgba(0, 224, 225, 0.22)",
  },
  surface: {
    darkSurface: "#111A27",
    elevatedSurface: "#1A2233",
    border: "#2A3347",
  },
  text: {
    primary: "#EAF1FF",
    secondary: "#B8C7E6",
    muted: "#8494B2",
  },
  semantic: {
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#EF4444",
    info: "#38BDF8",
  },
  action: {
    primaryBg: "#F2C14E",
    primaryText: "#040F1C",
    primaryBorder: "#F2C14E",
    primaryHoverBg: "#F6CF6A",
    secondaryBg: "transparent",
    secondaryText: "#EAF1FF",
    secondaryBorder: "#2A3347",
    secondaryHoverBorder: "#2EC5C9",
    technicalText: "#2EC5C9",
    technicalBorder: "#1A8F98",
    technicalHoverBorder: "#2EC5C9",
    technicalGlow: "rgba(0, 224, 225, 0.22)",
  },
} as const;

export type CabColorPalette = typeof cabColors;
