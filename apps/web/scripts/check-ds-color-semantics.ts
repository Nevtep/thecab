import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walkTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...walkTsxFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

function main() {
  const root = process.cwd();
  const issues: string[] = [];

  const cabButtonPath = join(root, "src/design-system/primitives/CabButton.tsx");
  const cabButton = readFileSync(cabButtonPath, "utf8");

  if (/primary:\s*{[\s\S]*backgroundColor:\s*cabColors\.brand\.signalTeal/.test(cabButton)) {
    issues.push("CabButton primary tone must not use cabColors.brand.signalTeal as filled background.");
  }

  if (!/primary:\s*{[\s\S]*backgroundColor:\s*cabColors\.action\.primaryBg/.test(cabButton)) {
    issues.push("CabButton primary tone must use cabColors.action.primaryBg.");
  }

  const appTsxFiles = walkTsxFiles(join(root, "src/app"));
  const forbiddenCyanFilledPatterns = [
    /background(?:Color)?\s*:\s*["'`]#00E0E1["'`]/,
    /background(?:Color)?\s*:\s*cabColors\.brand\.signalTeal/,
  ];

  for (const filePath of appTsxFiles) {
    const source = readFileSync(filePath, "utf8");

    for (const pattern of forbiddenCyanFilledPatterns) {
      if (pattern.test(source)) {
        issues.push(`Forbidden cyan-filled CTA/background pattern in ${filePath.replace(`${root}/`, "")}`);
        break;
      }
    }
  }

  if (issues.length > 0) {
    console.error("Design-system color semantics check failed.\n");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log("Design-system color semantics check passed");
}

main();
