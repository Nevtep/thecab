#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  fetchVerifiedContractAbi,
  type ContractAbiRecord,
} from "../../apps/web/src/server/analysis/decoded-history";
import { KNOWN_RESEARCH_CONTRACT_SEEDS } from "./known-contract-seeds";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = resolve(rootDir, "apps/web/.env.local");
const outputDir = resolve(rootDir, "docs/api-research/abis/base-8453");
const registryPath = resolve(rootDir, "docs/api-research/abis/protocol-abi-registry.json");
const readmePath = resolve(rootDir, "docs/api-research/abis/README.md");

function loadEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function writeJson(path: string, data: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchWithBackoff(seed: typeof KNOWN_RESEARCH_CONTRACT_SEEDS[number]) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await fetchVerifiedContractAbi({
        chainId: 8453,
        seed,
        apiKey: process.env.BASESCAN_API_KEY ?? "",
      });
    } catch (error) {
      lastError = error;
      if (!String(error instanceof Error ? error.message : error).toLowerCase().includes("rate limit")) break;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1250 * attempt));
    }
  }
  throw lastError;
}

function buildReadme(fetchedAt: string, entries: ContractAbiRecord[]) {
  const rows = entries
    .map((entry) => {
      const status = entry.abi ? "verified ABI" : "missing ABI";
      const proxy = entry.source.proxy ? `proxy -> ${entry.source.implementation}` : "direct";
      return `| ${entry.protocol} | ${entry.label} | \`${entry.address}\` | ${entry.source.contractName ?? "unknown"} | ${status} | ${proxy} |`;
    })
    .join("\n");

  return `# Protocol ABI Registry Research

Generated at: ${fetchedAt}

This registry is a research artifact for the historical transaction-classification engine. It keeps the classifier grounded in verified deployed contracts instead of undocumented selector guesses.

## Source Anchors

- Aerodrome official repository: \`https://github.com/aerodrome-finance/contracts\`
- Mellow official organization: \`https://github.com/mellow-finance\`
- Mellow ALM source repository: \`https://github.com/mellow-finance/mellow-alm-toolkit\`
- Deployed ABI authority: BaseScan verified source/ABI for the exact Base address seen in transaction history.

## Update Method

Run:

\`\`\`sh
pnpm --dir ./apps/web exec tsx ../../scripts/research/fetch-protocol-abis.ts
\`\`\`

The script reads \`BASESCAN_API_KEY\` from \`apps/web/.env.local\`, calls Etherscan v2 \`contract/getsourcecode\` for Base \`chainid=8453\`, and writes one JSON artifact per tracked Base contract under \`docs/api-research/abis/base-8453/\`.

For engine usage, the same ABI fetcher can be backed by a DB implementation of \`AbiRegistryRepository\`: read ABI by \`(chainId,address)\`, fetch from explorer only on cache miss, then persist the returned \`ContractAbiRecord\`.

## Registry Entries

| Protocol | Label | Address | Contract name | ABI status | Proxy |
| --- | --- | --- | --- | --- | --- |
${rows}
`;
}

async function main() {
  loadEnv();
  if (!process.env.BASESCAN_API_KEY) {
    throw new Error("BASESCAN_API_KEY is required in apps/web/.env.local");
  }

  mkdirSync(outputDir, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const entries: Array<ContractAbiRecord & { artifact: string; abiEntryCount: number }> = [];

  for (const seed of KNOWN_RESEARCH_CONTRACT_SEEDS) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 450));
    const record = await fetchWithBackoff(seed);
    const artifact = `docs/api-research/abis/base-8453/${record.address}.json`;
    writeJson(resolve(rootDir, artifact), record);
    entries.push({
      ...record,
      artifact,
      abiEntryCount: Array.isArray(record.abi) ? record.abi.length : 0,
    });
    console.log(`${record.abi ? "ok" : "missing"} ${record.label} ${record.address}`);
  }

  writeJson(registryPath, {
    generatedAt: fetchedAt,
    chainId: 8453,
    sourcePolicy: {
      primary: "Etherscan v2 getsourcecode for deployed Base contracts",
      verificationRule:
        "Address + chainId + verified ABI + proxy implementation metadata must match before classifier decodes confidently.",
    },
    entries: entries.map(({ abi, ...entry }) => entry),
  });
  writeFileSync(readmePath, buildReadme(fetchedAt, entries));
}

void main();
