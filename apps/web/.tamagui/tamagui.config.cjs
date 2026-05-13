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
var tokens = (0, import_core.createTokens)({
  color: {
    background: "#040F1C",
    backgroundElevated: "#0F1826",
    foreground: "#EAF1FF",
    muted: "#B8C7E6",
    accent: "#00E0E1",
    gold: "#F2C14E"
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
    0: 0,
    1: 6,
    2: 10,
    3: 14,
    4: 18,
    true: 10
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
  themes: {
    dark: {
      background: tokens.color.background,
      color: tokens.color.foreground,
      borderColor: "#2A3347",
      accentColor: tokens.color.accent
    }
  },
  defaultTheme: "dark"
});
var tamagui_config_default = config;
