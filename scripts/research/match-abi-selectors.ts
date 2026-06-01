#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAbiSelectorIndex,
  buildRegistryMap,
  collectObservedSelectors,
  decodedTransactionsFromPagePayload,
  summarizeObservedSelectors,
  type ContractAbiRecord,
} from "../../apps/web/src/server/analysis/decoded-history";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const samplePath = resolve(rootDir, "docs/api-research/moralis/address-transactions-decoded-response.json");
const registryPath = resolve(rootDir, "docs/api-research/abis/protocol-abi-registry.json");
const outputPath = resolve(rootDir, "docs/api-research/abis/selector-matches-address-transactions-decoded.json");
const markdownPath = resolve(rootDir, "docs/api-research/abis/selector-matches-address-transactions-decoded.md");

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function loadRegistry() {
  const registry = loadJson(registryPath) as {
    entries: Array<ContractAbiRecord & { artifact: string }>;
  };
  return buildRegistryMap(registry.entries.map((entry) => (
    loadJson(resolve(rootDir, entry.artifact)) as ContractAbiRecord
  )));
}

function buildMarkdown(result: {
  generatedAt: string;
  functions: Array<{ key: string; occurrences: Array<{ txIndex: number }>; matches: Array<{ label: string; signature: string }> }>;
  events: Array<{ key: string; occurrences: Array<{ txIndex: number }>; matches: Array<{ label: string; signature: string }> }>;
}) {
  const fnRows = result.functions
    .map((item) => {
      const txs = item.occurrences.map((occurrence) => `${occurrence.txIndex}`).join(", ");
      const matches = item.matches.length
        ? item.matches.map((match) => `${match.label}: \`${match.signature}\``).join("<br>")
        : "unmatched";
      return `| \`${item.key}\` | ${txs} | ${matches} |`;
    })
    .join("\n");

  const eventRows = result.events
    .map((item) => {
      const txs = [...new Set(item.occurrences.map((occurrence) => `${occurrence.txIndex}`))].join(", ");
      const matches = item.matches.length
        ? item.matches.map((match) => `${match.label}: \`${match.signature}\``).join("<br>")
        : "unmatched";
      return `| \`${item.key}\` | ${txs} | ${matches} |`;
    })
    .join("\n");

  return `# ABI Selector Matches For Moralis Decoded Sample

Generated at: ${result.generatedAt}

This file matches observed transaction input selectors and log topics from \`docs/api-research/moralis/address-transactions-decoded-response.json\` against the verified ABI registry under \`docs/api-research/abis/base-8453/\`.

## Function Selectors

| Selector | Tx indexes | Verified ABI matches |
| --- | --- | --- |
${fnRows}

## Event Topics

| Topic | Tx indexes | Verified ABI matches |
| --- | --- | --- |
${eventRows}
`;
}

const payload = loadJson(samplePath);
const observed = collectObservedSelectors(decodedTransactionsFromPagePayload(payload));
const index = buildAbiSelectorIndex(loadRegistry());
const result = {
  generatedAt: new Date().toISOString(),
  sourceSample: "docs/api-research/moralis/address-transactions-decoded-response.json",
  sourceRegistry: "docs/api-research/abis/protocol-abi-registry.json",
  functions: summarizeObservedSelectors(observed.inputs, index.byFunctionSelector),
  events: summarizeObservedSelectors(observed.topics, index.byEventTopic),
};

writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(markdownPath, buildMarkdown(result));
console.log(`wrote ${outputPath}`);
console.log(`wrote ${markdownPath}`);
