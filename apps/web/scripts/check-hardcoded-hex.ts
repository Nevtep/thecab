import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SCAN_DIRS = ["src/app", "src/features"];
const ALLOWED_HEX = new Set(["#000", "#000000", "#fff", "#ffffff"]);
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

function walkFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath, extensions));
      continue;
    }

    if (extensions.some((ext) => fullPath.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  const root = process.cwd();
  const violations: string[] = [];

  for (const scanDir of SCAN_DIRS) {
    const absoluteDir = join(root, scanDir);

    for (const filePath of walkFiles(absoluteDir, [".tsx", ".css"])) {
      const source = readFileSync(filePath, "utf8");
      const matches = source.match(HEX_PATTERN) ?? [];
      const unique = [...new Set(matches)].filter((hex) => !ALLOWED_HEX.has(hex.toLowerCase()));

      if (unique.length > 0) {
        violations.push(`${relative(root, filePath)}: ${unique.join(", ")}`);
      }
    }
  }

  if (violations.length > 0) {
    console.warn("Hardcoded hex inventory (ER-002 advisory — migrate to CSS tokens):\n");
    for (const violation of violations) {
      console.warn(`- ${violation}`);
    }
    console.warn(`\nTotal files with hardcoded hex: ${violations.length}`);
    return;
  }

  console.log("No hardcoded hex found in product app/features paths");
}

main();
