#!/usr/bin/env tsx
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildClassifiedDecodedTransaction,
  buildRegistryMap,
  decodedTransactionsFromPagePayload,
  dedupeDecodedTransactions,
  normalizeAddress,
  sortDecodedTransactionsChronologically,
  type Address,
  type ClassifiedDecodedTransaction,
  type ContractAbiRecord,
  type MoralisDecodedTransaction,
} from "../../apps/web/src/server/analysis/decoded-history";
import { buildClassificationReport, serializeBigInt } from "./research-report";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const walletAddress = normalizeAddress("0x0ecd939b7fcA4dC4A0675d8D28BAd12cefaE0954") as Address;

type ResearchTx = MoralisDecodedTransaction & {
  __file?: string;
  __rowIndex?: number;
};

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function pageFiles() {
  return readdirSync(resolve(rootDir, "docs/api-research/moralis"))
    .filter((file) => /^address-transactions-decoded-page\d+-response\.json$/.test(file))
    .sort((a, b) => Number(a.match(/page(\d+)/)?.[1] ?? 0) - Number(b.match(/page(\d+)/)?.[1] ?? 0));
}

function loadRegistry() {
  const registry = loadJson(resolve(rootDir, "docs/api-research/abis/protocol-abi-registry.json")) as {
    entries: Array<ContractAbiRecord & { artifact: string }>;
  };
  const records = registry.entries.map((entry) => {
    const artifact = loadJson(resolve(rootDir, entry.artifact)) as ContractAbiRecord;
    return artifact;
  });
  return buildRegistryMap(records);
}

function classifyAll(transactions: ResearchTx[]) {
  const registry = loadRegistry();
  return transactions.map((tx, index) => ({
    ...buildClassifiedDecodedTransaction({
      tx,
      walletAddress,
      registry,
    }),
    index: index + 1,
    pageFile: tx.__file,
    pageRow: tx.__rowIndex,
  }));
}

function summarize(transactions: ClassifiedDecodedTransaction[]) {
  const byClassification: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  for (const tx of transactions) {
    byClassification[tx.classification] = (byClassification[tx.classification] ?? 0) + 1;
    byConfidence[tx.confidence] = (byConfidence[tx.confidence] ?? 0) + 1;
  }

  const unresolvedSelectors = new Map<string, {
    count: number;
    toAddress: string;
    selector: string;
    exampleHash: string;
    reason: string;
  }>();
  for (const tx of transactions) {
    if (!tx.needsResolution) continue;
    if (tx.classification !== "unclassified_transaction" && tx.classification !== "protocol_contract_call_unmapped") continue;
    const key = `${tx.toAddress}:${tx.selector}:${tx.reason}`;
    const current = unresolvedSelectors.get(key) ?? {
      count: 0,
      toAddress: tx.toAddress,
      selector: tx.selector,
      exampleHash: tx.hash,
      reason: tx.reason,
    };
    current.count += 1;
    unresolvedSelectors.set(key, current);
  }

  return {
    byClassification,
    byConfidence,
    needsResolutionCount: transactions.filter((tx) => tx.needsResolution).length,
    unresolvedSelectors: [...unresolvedSelectors.values()].sort((a, b) => b.count - a.count),
  };
}

const files = pageFiles();
const rawTransactions: ResearchTx[] = [];
for (const file of files) {
  const payload = loadJson(resolve(rootDir, "docs/api-research/moralis", file));
  decodedTransactionsFromPagePayload(payload).forEach((tx, rowIndex) => {
    rawTransactions.push({ ...tx, __file: file, __rowIndex: rowIndex + 1 });
  });
}

const transactions = classifyAll(sortDecodedTransactionsChronologically(dedupeDecodedTransactions(rawTransactions)) as ResearchTx[]);
const unique = new Set(rawTransactions.map((tx) => tx.hash));
const summary = summarize(transactions);
const output = {
  generatedAt: new Date().toISOString(),
  walletAddress,
  files,
  summary: {
    rawRows: rawTransactions.length,
    uniqueTransactions: unique.size,
    firstTimestamp: transactions[0]?.timestamp ?? null,
    lastTimestamp: transactions.at(-1)?.timestamp ?? null,
    ...summary,
  },
  transactions,
};

writeFileSync(
  resolve(rootDir, "docs/api-research/moralis/address-transactions-decoded-full-classification.json"),
  `${JSON.stringify(JSON.parse(serializeBigInt(output)), null, 2)}\n`,
);
writeFileSync(
  resolve(rootDir, "docs/informe-clasificacion-historica-wallet-moralis-533tx.md"),
  buildClassificationReport({
    generatedAt: output.generatedAt,
    files,
    walletAddress,
    rawRows: output.summary.rawRows,
    uniqueTransactions: output.summary.uniqueTransactions,
    firstTimestamp: output.summary.firstTimestamp,
    lastTimestamp: output.summary.lastTimestamp,
    summary,
    transactions,
  }),
);
console.log(JSON.stringify(output.summary, null, 2));
