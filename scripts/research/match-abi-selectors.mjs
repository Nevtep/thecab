#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const result = spawnSync(
  "pnpm",
  ["--dir", "./apps/web", "exec", "tsx", "../../scripts/research/match-abi-selectors.ts"],
  { cwd: rootDir, stdio: "inherit" },
);

process.exit(result.status ?? 1);
