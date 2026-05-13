var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// tamagui.config.ts
var tamagui_config_exports = {};
__export(tamagui_config_exports, {
  default: () => tamagui_config_default
});
module.exports = __toCommonJS(tamagui_config_exports);
var import_core = require("@tamagui/core");
var interFont = (0, import_core.createFont)({
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
    true: 15
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
    true: 21
  },
  weight: {
    4: "400",
    5: "500",
    6: "600",
    7: "700"
  }
});
var orbitronFont = (0, import_core.createFont)({
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
    true: 17
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
    true: 23
  },
  weight: {
    5: "500",
    6: "600",
    7: "700"
  }
});
var monoFont = (0, import_core.createFont)({
  family: "var(--cab-font-data), 'IBM Plex Mono', ui-monospace, monospace",
  size: {
    1: 10,
    2: 11,
    3: 12,
    4: 13,
    5: 14,
    6: 16,
    true: 12
  },
  lineHeight: {
    1: 13,
    2: 14,
    3: 16,
    4: 18,
    5: 19,
    6: 22,
    true: 16
  },
  weight: {
    4: "400",
    5: "500",
    6: "600"
  }
});
var tokens = (0, import_core.createTokens)({
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
    signalTealUi: "#2EC5C9",
    signalTealMuted: "#1A8F98",
    signalTealGlow: "rgba(0, 224, 225, 0.22)",
    electricBlue: "#3B82F6",
    gold: "#F2C14E",
    primaryActionBg: "#F2C14E",
    primaryActionText: "#040F1C",
    primaryActionBorder: "#F2C14E",
    primaryActionHoverBg: "#F6CF6A",
    secondaryActionBg: "transparent",
    secondaryActionText: "#EAF1FF",
    secondaryActionBorder: "#2A3347",
    secondaryActionHoverBorder: "#2EC5C9",
    technicalActionText: "#2EC5C9",
    technicalActionBorder: "#1A8F98",
    technicalActionHoverBorder: "#2EC5C9",
    technicalActionGlow: "rgba(0, 224, 225, 0.22)",
    success: "#22C55E",
    warning: "#FBBF24",
    danger: "#EF4444",
    info: "#38BDF8"
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
    true: 16
  },
  space: {
    0: 0,
    1: 8,
    2: 12,
    3: 16,
    4: 20,
    5: 24,
    6: 32,
    true: 16
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
    true: 6
  },
  zIndex: {
    0: 0,
    1: 10,
    2: 20,
    3: 30,
    4: 40,
    true: 1
  }
});
var config = (0, import_core.createTamagui)({
  tokens,
  fonts: {
    body: interFont,
    heading: orbitronFont,
    mono: monoFont
  },
  themes: {
    dark: {
      background: tokens.color.background,
      color: tokens.color.foreground,
      borderColor: tokens.color.border,
      accentColor: tokens.color.accent
    }
  },
  defaultTheme: "dark",
  defaultFont: "body"
});
var tamagui_config_default = config;
