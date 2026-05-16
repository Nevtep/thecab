import { cabColors } from "../src/design-system/tokens/colors";

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb | null {
  const normalized = hex.trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(normalized);
  if (!match) {
    return null;
  }

  const raw = match[1];
  if (raw.length === 3) {
    return {
      r: parseInt(raw[0] + raw[0], 16),
      g: parseInt(raw[1] + raw[1], 16),
      b: parseInt(raw[2] + raw[2], 16),
    };
  }

  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function relativeLuminance({ r, g, b }: Rgb) {
  const channel = [r, g, b].map((value) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channel[0] + 0.7152 * channel[1] + 0.0722 * channel[2];
}

function contrastRatio(foreground: string, background: string) {
  const fg = parseHex(foreground);
  const bg = parseHex(background);

  if (!fg || !bg) {
    return null;
  }

  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

const pairs: Array<{ name: string; fg: string; bg: string; min: number }> = [
  { name: "text.primary on darkSurface", fg: cabColors.text.primary, bg: cabColors.surface.darkSurface, min: 4.5 },
  { name: "text.secondary on darkSurface", fg: cabColors.text.secondary, bg: cabColors.surface.darkSurface, min: 4.5 },
  { name: "text.muted on darkSurface", fg: cabColors.text.muted, bg: cabColors.surface.darkSurface, min: 4.5 },
  { name: "text.primary on elevatedSurface", fg: cabColors.text.primary, bg: cabColors.surface.elevatedSurface, min: 4.5 },
  { name: "text.muted on elevatedSurface", fg: cabColors.text.muted, bg: cabColors.surface.elevatedSurface, min: 4.5 },
  { name: "primaryActionText on primaryActionBg", fg: cabColors.action.primaryText, bg: cabColors.action.primaryBg, min: 4.5 },
  { name: "technicalActionText on cabNight", fg: cabColors.action.technicalText, bg: cabColors.brand.cabNight, min: 4.5 },
  { name: "semantic.success on darkSurface", fg: cabColors.semantic.success, bg: cabColors.surface.darkSurface, min: 3 },
  { name: "semantic.danger on darkSurface", fg: cabColors.semantic.danger, bg: cabColors.surface.darkSurface, min: 3 },
];

function main() {
  const failures: string[] = [];

  for (const pair of pairs) {
    const ratio = contrastRatio(pair.fg, pair.bg);

    if (ratio === null) {
      failures.push(`${pair.name}: could not parse colors (${pair.fg} / ${pair.bg})`);
      continue;
    }

    if (ratio < pair.min) {
      failures.push(`${pair.name}: ${ratio.toFixed(2)}:1 (required ${pair.min}:1)`);
    } else {
      console.log(`OK  ${pair.name}: ${ratio.toFixed(2)}:1`);
    }
  }

  if (failures.length > 0) {
    console.error("\nWCAG contrast check failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("\nWCAG contrast check passed");
}

main();
