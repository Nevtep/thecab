import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildRegistryMap, type ContractAbiRecord } from "@/server/analysis/decoded-history";
import { classifyTransactionsChronologically } from "@/server/analysis/engine-v2/classification";
import { parseMoralisDecodedHistoryPage } from "@/server/analysis/engine-v2/collection";

import { loadMoralisDecodedHistoryFixtures } from "./fixtures";

type ClassificationSummaryArtifact = {
  summary: {
    byClassification: Record<string, number>;
  };
};

type PrefixCounts = {
  governance: number;
  manualPosition: number;
  strategy: number;
};

export function runClassificationRegression(input: {
  fixtureDirectory?: string;
  walletAddress?: string;
  abiRegistryPath?: string;
  validatedClassificationPath?: string;
}) {
  const pages = loadMoralisDecodedHistoryFixtures(input.fixtureDirectory)
    .filter((page) => /^address-transactions-decoded-page\d+-response\.json$/.test(page.fileName));
  if (pages.length === 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_FIXTURES_NOT_FOUND");
  }

  const transactions = pages.flatMap((page) => parseMoralisDecodedHistoryPage(page.payload).transactions);
  const walletAddress = input.walletAddress ?? inferMostObservedWalletAddress(transactions);
  if (!walletAddress) {
    throw new Error("ENGINE_V2_CLASSIFICATION_WALLET_NOT_RESOLVED");
  }
  const registry = loadFixtureAbiRegistry(input.abiRegistryPath);
  const classified = classifyTransactionsChronologically({
    transactions,
    walletAddress: walletAddress as `0x${string}`,
    registry,
  });
  const byClassification = countByClassification(classified.map((item) => item.classification.eventType));
  const families = new Set(classified.map((item) => item.classification.eventFamily));
  const unresolvedCount = classified.filter((item) => item.classification.coverageStatus === "partial" || item.classification.coverageStatus === "unresolved").length;
  const unclassifiedCount = byClassification.unclassified_transaction ?? 0;
  const unmappedCount = byClassification.protocol_contract_call_unmapped ?? 0;
  const expectedByClassification = loadValidatedClassificationSummary(input.validatedClassificationPath);
  const categoryCounts = summarizePrefixCounts(byClassification);
  const expectedCategoryCounts = summarizePrefixCounts(expectedByClassification);

  if (classified.length !== transactions.length) {
    throw new Error("ENGINE_V2_CLASSIFICATION_COUNT_MISMATCH");
  }
  if (families.size === 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_EMPTY_FAMILIES");
  }
  if (unclassifiedCount > 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_UNCLASSIFIED_PRESENT");
  }
  if (unmappedCount > 0) {
    throw new Error("ENGINE_V2_CLASSIFICATION_UNMAPPED_PRESENT");
  }
  if (
    categoryCounts.governance !== expectedCategoryCounts.governance ||
    categoryCounts.manualPosition !== expectedCategoryCounts.manualPosition ||
    categoryCounts.strategy !== expectedCategoryCounts.strategy
  ) {
    throw new Error("ENGINE_V2_CLASSIFICATION_CATEGORY_COUNT_MISMATCH");
  }

  return {
    transactionCount: classified.length,
    walletAddress,
    registrySize: registry.size,
    families: [...families].sort(),
    unresolvedCount,
    unclassifiedCount,
    unmappedCount,
    categoryCounts,
    byClassification,
  };
}

function repoRoot() {
  return resolve(process.cwd(), "../..");
}

function loadFixtureAbiRegistry(path = "docs/api-research/abis/protocol-abi-registry.json") {
  const manifestPath = resolve(repoRoot(), path);
  if (!existsSync(manifestPath)) {
    throw new Error("ENGINE_V2_CLASSIFICATION_ABI_REGISTRY_NOT_FOUND");
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    entries: Array<ContractAbiRecord & { artifact: string }>;
  };
  const records = manifest.entries.map((entry) => {
    const artifactPath = resolve(repoRoot(), entry.artifact);
    return JSON.parse(readFileSync(artifactPath, "utf8")) as ContractAbiRecord;
  });
  return buildRegistryMap(records);
}

function loadValidatedClassificationSummary(path = "docs/api-research/moralis/address-transactions-decoded-full-classification.json") {
  const summaryPath = resolve(repoRoot(), path);
  if (!existsSync(summaryPath)) {
    throw new Error("ENGINE_V2_CLASSIFICATION_VALIDATED_SUMMARY_NOT_FOUND");
  }

  const artifact = JSON.parse(readFileSync(summaryPath, "utf8")) as ClassificationSummaryArtifact;
  return artifact.summary.byClassification;
}

function countByClassification(classifications: string[]) {
  return classifications.reduce<Record<string, number>>((counts, classification) => {
    counts[classification] = (counts[classification] ?? 0) + 1;
    return counts;
  }, {});
}

function summarizePrefixCounts(byClassification: Record<string, number>): PrefixCounts {
  return Object.entries(byClassification).reduce<PrefixCounts>((counts, [classification, count]) => {
    if (classification.startsWith("governance_")) counts.governance += count;
    if (classification.startsWith("manual_position_")) counts.manualPosition += count;
    if (classification.startsWith("strategy_")) counts.strategy += count;
    return counts;
  }, {
    governance: 0,
    manualPosition: 0,
    strategy: 0,
  });
}

function inferMostObservedWalletAddress(transactions: Array<{ from_address?: string | null; to_address?: string | null }>) {
  const counts = new Map<string, number>();
  for (const tx of transactions) {
    for (const address of [tx.from_address, tx.to_address]) {
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) continue;
      const normalized = address.toLowerCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
