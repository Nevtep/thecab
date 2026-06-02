import { engineV2ClassifiedTransactions } from "@/server/db/schema";

type ClassifiedRow = typeof engineV2ClassifiedTransactions.$inferSelect;

type SelectorDiagnostic = {
  selector: string;
  txCount: number;
  classifications: Record<string, number>;
  contractLabels: string[];
  decodedFunctions: string[];
  reasons: string[];
  exampleTxHashes: string[];
};

type ExampleDiagnostic = {
  txHash: string;
  selector: string;
  classification: string;
  confidence: string;
  reason: string;
  contractLabel: string | null;
  decodedFunction: string | null;
  needsResolution: boolean;
};

export type EngineV2DiagnosticsArtifact = {
  summary: {
    transactionCount: number;
    needsResolutionCount: number;
    byClassification: Record<string, number>;
    byConfidence: Record<string, number>;
  };
  unresolvedSelectors: SelectorDiagnostic[];
  examples: ExampleDiagnostic[];
};

function incrementCount(counts: Record<string, number>, key: string | null | undefined) {
  const normalizedKey = key && key.length > 0 ? key : "unknown";
  counts[normalizedKey] = (counts[normalizedKey] ?? 0) + 1;
}

function uniqueSorted(values: Iterable<string | null | undefined>) {
  return Array.from(new Set(
    [...values].filter((value): value is string => typeof value === "string" && value.length > 0),
  )).sort();
}

function buildSelectorDiagnostics(rows: ClassifiedRow[], limit: number) {
  const grouped = new Map<string, ClassifiedRow[]>();

  for (const row of rows.filter((item) => item.needsResolution)) {
    const key = row.selector || "0x";
    const existing = grouped.get(key);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  return [...grouped.entries()]
    .map(([selector, group]) => {
      const classifications = group.reduce<Record<string, number>>((counts, row) => {
        incrementCount(counts, row.classification);
        return counts;
      }, {});

      return {
        selector,
        txCount: group.length,
        classifications,
        contractLabels: uniqueSorted(group.map((row) => row.contractLabel ?? row.contractName ?? null)),
        decodedFunctions: uniqueSorted(group.map((row) => row.decodedFunction)),
        reasons: uniqueSorted(group.map((row) => row.reason)),
        exampleTxHashes: uniqueSorted(group.map((row) => row.txHash)).slice(0, 5),
      } satisfies SelectorDiagnostic;
    })
    .sort((left, right) => right.txCount - left.txCount || left.selector.localeCompare(right.selector))
    .slice(0, limit);
}

function buildExampleDiagnostics(rows: ClassifiedRow[], limit: number) {
  return [...rows]
    .sort((left, right) => {
      if (left.needsResolution !== right.needsResolution) {
        return left.needsResolution ? -1 : 1;
      }
      const leftTime = left.occurredAt?.getTime() ?? 0;
      const rightTime = right.occurredAt?.getTime() ?? 0;
      return rightTime - leftTime || left.txHash.localeCompare(right.txHash);
    })
    .slice(0, limit)
    .map((row) => ({
      txHash: row.txHash,
      selector: row.selector,
      classification: row.classification,
      confidence: row.confidence,
      reason: row.reason,
      contractLabel: row.contractLabel ?? row.contractName ?? null,
      decodedFunction: row.decodedFunction ?? null,
      needsResolution: row.needsResolution,
    } satisfies ExampleDiagnostic));
}

export function buildEngineV2DiagnosticsArtifact(input: {
  rows: ClassifiedRow[];
  selectorLimit?: number;
  exampleLimit?: number;
}): EngineV2DiagnosticsArtifact {
  const byClassification = input.rows.reduce<Record<string, number>>((counts, row) => {
    incrementCount(counts, row.classification);
    return counts;
  }, {});
  const byConfidence = input.rows.reduce<Record<string, number>>((counts, row) => {
    incrementCount(counts, row.confidence);
    return counts;
  }, {});

  return {
    summary: {
      transactionCount: input.rows.length,
      needsResolutionCount: input.rows.filter((row) => row.needsResolution).length,
      byClassification,
      byConfidence,
    },
    unresolvedSelectors: buildSelectorDiagnostics(input.rows, input.selectorLimit ?? 20),
    examples: buildExampleDiagnostics(input.rows, input.exampleLimit ?? 20),
  };
}