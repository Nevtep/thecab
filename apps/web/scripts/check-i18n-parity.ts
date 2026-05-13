import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

function flattenKeys(value: JsonValue, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    const nestedKeys = flattenKeys(nested, nextPrefix);
    return nestedKeys.length > 0 ? nestedKeys : [nextPrefix];
  });
}

function readJson(filePath: string): JsonValue {
  return JSON.parse(readFileSync(filePath, "utf8")) as JsonValue;
}

function main() {
  const root = process.cwd();
  const enDir = join(root, "src/i18n/locales/en");
  const esDir = join(root, "src/i18n/locales/es");

  const enFiles = readdirSync(enDir).filter((name) => name.endsWith(".json")).sort();
  const esFiles = readdirSync(esDir).filter((name) => name.endsWith(".json")).sort();

  const missingInEs = enFiles.filter((file) => !esFiles.includes(file));
  const missingInEn = esFiles.filter((file) => !enFiles.includes(file));

  const issues: string[] = [];

  if (missingInEs.length > 0) {
    issues.push(`Missing ES files: ${missingInEs.join(", ")}`);
  }

  if (missingInEn.length > 0) {
    issues.push(`Missing EN files: ${missingInEn.join(", ")}`);
  }

  for (const file of enFiles) {
    if (!esFiles.includes(file)) continue;

    const enJson = readJson(join(enDir, file));
    const esJson = readJson(join(esDir, file));

    const enKeys = flattenKeys(enJson).sort();
    const esKeys = flattenKeys(esJson).sort();

    const missingKeysInEs = enKeys.filter((key) => !esKeys.includes(key));
    const missingKeysInEn = esKeys.filter((key) => !enKeys.includes(key));

    if (missingKeysInEs.length > 0) {
      issues.push(`${file}: missing keys in ES -> ${missingKeysInEs.join(", ")}`);
    }

    if (missingKeysInEn.length > 0) {
      issues.push(`${file}: missing keys in EN -> ${missingKeysInEn.join(", ")}`);
    }
  }

  if (issues.length > 0) {
    console.error("i18n parity check failed\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("i18n parity check passed");
}

main();
