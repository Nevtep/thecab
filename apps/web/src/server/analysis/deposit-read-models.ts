/**
 * Materializes wallet-scoped deposit read models from analysis-engine output.
 *
 * NOTE (010-deposits-lifecycle T007-T010): This is the wiring skeleton.
 * The full implementation populates `deposit_wallet_summaries`,
 * `deposit_lifecycle_events`, and `deposit_performance_decompositions`
 * from the canonical engine tables (deposits, ledger_events, asset_movements,
 * reward_events, attribution_states, inferred_actions) and enforces the
 * reconciliation invariant `|total_return - components_sum| <= 1e-9`.
 *
 * The skeleton is intentionally side-effect-free until the source data
 * derivation lands. Once enabled, all inserts MUST use the chunked helpers
 * to avoid the `mergeQueries` overflow noted in repo memory
 * `analysis-engine-history-notes`.
 */

import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import {
  depositLifecycleEvents,
  depositPerformanceDecompositions,
  depositWalletSummaries,
} from "@/server/db/schema";

export type MaterializeDepositReadModelsInput = {
  runId: string;
  walletAddress: string;
  chainId: number;
  startDayUtc: string;
  endDayUtc: string;
  capturedAt: Date;
};

export type MaterializeDepositReadModelsResult = {
  summariesWritten: number;
  lifecycleEventsWritten: number;
  decompositionsWritten: number;
};

const READ_MODEL_INSERT_CHUNK_SIZE = 250;

export async function chunkedInsert<TRow>(
  rows: TRow[],
  flush: (chunk: TRow[]) => Promise<void>,
  chunkSize: number = READ_MODEL_INSERT_CHUNK_SIZE,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      await flush(chunk);
    }
  }
}

export async function materializeDepositReadModels(
  input: MaterializeDepositReadModelsInput,
): Promise<MaterializeDepositReadModelsResult> {
  const db = await getDb();
  const scopeFilter = and(
    eq(depositWalletSummaries.chainId, input.chainId),
    eq(depositWalletSummaries.walletAddress, input.walletAddress),
  );

  // Purge previous run's read models for this wallet scope before re-materializing.
  // FK-safe order: lifecycle + decompositions (deposit_id refs) THEN summaries.
  await db
    .delete(depositLifecycleEvents)
    .where(and(
      eq(depositLifecycleEvents.chainId, input.chainId),
      eq(depositLifecycleEvents.walletAddress, input.walletAddress),
    ));
  await db
    .delete(depositPerformanceDecompositions)
    .where(and(
      eq(depositPerformanceDecompositions.chainId, input.chainId),
      eq(depositPerformanceDecompositions.walletAddress, input.walletAddress),
    ));
  await db.delete(depositWalletSummaries).where(scopeFilter);

  // TODO(010-deposits-lifecycle T028-T029, T033-T035, T060): derive per-deposit
  //   summary, lifecycle events, performance decomposition from existing engine
  //   tables, then write via chunkedInsert helpers. Until that work lands,
  //   this materializer leaves the read models empty after purge and the
  //   Deposits MVP UI renders the configured EmptyState.
  return {
    summariesWritten: 0,
    lifecycleEventsWritten: 0,
    decompositionsWritten: 0,
  };
}
