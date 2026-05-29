/**
 * Surface and economic-component taxonomy for the reward/fee classification
 * pipeline.
 *
 * See `docs/spec/the-cab-aerodrome-claim-surfaces-research.md` for the
 * protocol-level mapping that this taxonomy mirrors and the no-heuristics
 * guardrails the pipeline must honor.
 *
 * This module is intentionally side-effect-free and dependency-free so it can
 * be imported from any layer (decoders, persistence, read models) without
 * introducing cycles.
 */

/**
 * On-chain surface through which a value-bearing transaction reached the
 * wallet. Used to drive ownership attribution and persistence policy.
 */
export type SurfaceKind =
  | "manual_deposit_gauge_claim"
  | "pool_fee_claim_v2"
  | "pool_fee_claim_slipstream"
  | "strategy_wrapper_reward_claim"
  | "strategy_wrapper_withdraw"
  | "gauge_reward_unknown_surface"
  | "governance_voter_claim"
  | "airdrop_spam"
  | "other";

/**
 * Economically distinct component a transaction can yield. A single tx can
 * emit more than one component (e.g. wrapper withdraw → `strategy_close` +
 * `reward_claim` when the reward token is deterministically separable).
 */
export type EconomicComponentKind =
  | "reward_claim"
  | "fee_claim"
  | "strategy_close"
  | "strategy_withdraw_partial"
  | "deposit_close"
  | "principal_return"
  | "excluded_airdrop";

/**
 * Reason a ledger event / history record is excluded from the economic
 * pipeline entirely (no reward / fee row written, no lifecycle effect).
 */
export type EconomicExclusionReason = "airdrop_spam";

/**
 * Schema version stamped on persisted reward candidates so reclassify can
 * detect stale shapes and regenerate them from history.
 */
export const CANDIDATE_SCHEMA_VERSION = 2 as const;

/**
 * Deterministically detect whether a raw provider history record represents
 * value that must be excluded from the economic pipeline before any reward
 * candidate is generated.
 *
 * Only the provider's explicit airdrop tag is honored here. Token-signal-only
 * spam detection (`possibleSpam`, `verifiedContract === false`) is performed
 * downstream by `classifyRunLedgerEvents`, so this early gate stays
 * conservative and cannot drop a legitimate reward inflow that happens to
 * have a not-yet-verified token registry entry.
 *
 * @returns the exclusion reason, or `null` when the record is admissible.
 */
export function detectEconomicExclusionReason(
  record: Record<string, unknown>,
): EconomicExclusionReason | null {
  const category = typeof record.category === "string" ? record.category.toLowerCase() : null;
  const methodLabel = typeof record.method_label === "string" ? record.method_label.toLowerCase() : null;
  if (category === "airdrop" || methodLabel === "airdrop") {
    return "airdrop_spam";
  }
  return null;
}

/**
 * Convenience predicate around `detectEconomicExclusionReason`.
 */
export function isHistoryRecordEconomicallyExcluded(record: Record<string, unknown>): boolean {
  return detectEconomicExclusionReason(record) !== null;
}

const SURFACE_KIND_VALUES = new Set<SurfaceKind>([
  "manual_deposit_gauge_claim",
  "pool_fee_claim_v2",
  "pool_fee_claim_slipstream",
  "strategy_wrapper_reward_claim",
  "strategy_wrapper_withdraw",
  "gauge_reward_unknown_surface",
  "governance_voter_claim",
  "airdrop_spam",
  "other",
]);

/**
 * Type-safe parser for a `surfaceKind` value read from JSON metadata.
 * Returns `null` when the value is not a recognized `SurfaceKind`.
 */
export function parseSurfaceKind(value: unknown): SurfaceKind | null {
  return typeof value === "string" && SURFACE_KIND_VALUES.has(value as SurfaceKind)
    ? (value as SurfaceKind)
    : null;
}
