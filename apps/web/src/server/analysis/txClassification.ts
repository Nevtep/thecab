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
  | "pool_fee_claim"
  | "pool_fee_claim_v2"
  | "pool_fee_claim_slipstream"
  | "strategy_wrapper_reward_claim"
  | "strategy_wrapper_withdraw"
  | "gauge_reward_unknown_surface"
  | "governance_voter_claim"
  | "governance_voting_escrow"
  | "governance_vote"
  | "governance_relay"
  | "governance_bribe_claim"
  | "governance_fee_claim"
  | "governance_rebase_claim"
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
  | "governance_action"
  | "governance_reward"
  | "excluded_airdrop";

export type EconomicComponent = {
  componentKey: string;
  kind: EconomicComponentKind;
  surfaceKind: SurfaceKind;
  movementLogIndexes: number[];
  tokenAddresses: string[];
};

/**
 * Reason a ledger event / history record is excluded from the economic
 * pipeline entirely (no reward / fee row written, no lifecycle effect).
 */
export type EconomicExclusionReason = "airdrop_spam";

export type SupplementalExplorerEvidenceInput = {
  receipt?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>>;
  internalTransfers?: Array<Record<string, unknown>>;
  evidenceGapReasonCodes?: string[];
};

export type SupplementalExplorerClassification = {
  supplementalEvidenceUsed: boolean;
  evidenceUsedReasonCodes: string[];
  evidenceGapReasonCodes: string[];
  conflictReasonCodes: string[];
};

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
  "pool_fee_claim",
  "pool_fee_claim_v2",
  "pool_fee_claim_slipstream",
  "strategy_wrapper_reward_claim",
  "strategy_wrapper_withdraw",
  "gauge_reward_unknown_surface",
  "governance_voter_claim",
  "governance_voting_escrow",
  "governance_vote",
  "governance_relay",
  "governance_bribe_claim",
  "governance_fee_claim",
  "governance_rebase_claim",
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

/**
 * Convert persisted explorer evidence into stable classification metadata.
 * This deliberately records what evidence was used or missing without adding
 * ownership links; ownership still requires explicit deposit/strategy/reward
 * identity from protocol-backed sources.
 */
export function classifySupplementalExplorerEvidence(
  evidence: SupplementalExplorerEvidenceInput | null | undefined,
): SupplementalExplorerClassification {
  if (!evidence) {
    return {
      supplementalEvidenceUsed: false,
      evidenceUsedReasonCodes: [],
      evidenceGapReasonCodes: ["missingExplorerEvidence"],
      conflictReasonCodes: [],
    };
  }

  const evidenceUsedReasonCodes: string[] = [];
  const conflictReasonCodes: string[] = [];
  const gaps = new Set(evidence.evidenceGapReasonCodes ?? []);

  const receipt = evidence.receipt && typeof evidence.receipt === "object" && !Array.isArray(evidence.receipt)
    ? evidence.receipt
    : null;
  if (receipt) {
    evidenceUsedReasonCodes.push("explorerReceipt");
    if (receipt.status === "0x0") {
      conflictReasonCodes.push("revertedTransaction");
    }
  } else {
    gaps.add("missingExplorerReceipt");
  }

  if ((evidence.logs ?? []).length > 0) {
    evidenceUsedReasonCodes.push("explorerLogs");
  }

  if ((evidence.internalTransfers ?? []).length > 0) {
    evidenceUsedReasonCodes.push("explorerInternalTransfers");
  }

  return {
    supplementalEvidenceUsed: evidenceUsedReasonCodes.length > 0,
    evidenceUsedReasonCodes: [...new Set(evidenceUsedReasonCodes)],
    evidenceGapReasonCodes: [...gaps].sort(),
    conflictReasonCodes: [...new Set(conflictReasonCodes)],
  };
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];
}

function asLowerString(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function transferLogIndex(transfer: Record<string, unknown>, fallback: number) {
  const value = transfer.log_index ?? transfer.logIndex;
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function uniqueSorted(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function uniqueStrings(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

/**
 * Split a Moralis-shaped transaction record into economic components when the
 * protocol surface has deterministic movement boundaries. Unknown or ambiguous
 * splits deliberately return no reward component, avoiding reward inflation.
 */
export function decomposeTxEconomics(input: {
  txHash: string;
  record: Record<string, unknown>;
  surfaceKind: SurfaceKind;
  wrapperAddress?: string | null;
}): EconomicComponent[] {
  const txHash = input.txHash.toLowerCase();
  const walletTransfers = [
    ...asRecordArray(input.record.erc20_transfers),
    ...asRecordArray(input.record.native_transfers),
  ];
  const wrapperAddress = asLowerString(input.wrapperAddress);

  if (input.surfaceKind === "strategy_wrapper_withdraw") {
    const inbound = walletTransfers
      .map((transfer, index) => ({ transfer, logIndex: transferLogIndex(transfer, index) }))
      .filter(({ transfer }) => asLowerString(transfer.direction) === "receive");
    const rewardTransfers = inbound.filter(({ transfer }) =>
      wrapperAddress !== null && asLowerString(transfer.from_address) === wrapperAddress
    );
    const principalTransfers = inbound.filter(({ transfer }) =>
      wrapperAddress === null || asLowerString(transfer.from_address) !== wrapperAddress
    );

    const components: EconomicComponent[] = [];
    if (principalTransfers.length > 0) {
      components.push({
        componentKey: `${txHash}:strategy_close:${uniqueSorted(principalTransfers.map((item) => item.logIndex)).join("-")}`,
        kind: "strategy_close",
        surfaceKind: input.surfaceKind,
        movementLogIndexes: uniqueSorted(principalTransfers.map((item) => item.logIndex)),
        tokenAddresses: uniqueStrings(principalTransfers.map(({ transfer }) => asLowerString(transfer.address))),
      });
    }
    if (rewardTransfers.length > 0) {
      components.push({
        componentKey: `${txHash}:reward_claim:${uniqueSorted(rewardTransfers.map((item) => item.logIndex)).join("-")}`,
        kind: "reward_claim",
        surfaceKind: input.surfaceKind,
        movementLogIndexes: uniqueSorted(rewardTransfers.map((item) => item.logIndex)),
        tokenAddresses: uniqueStrings(rewardTransfers.map(({ transfer }) => asLowerString(transfer.address))),
      });
    }
    return components;
  }

  if (
    input.surfaceKind === "pool_fee_claim" ||
    input.surfaceKind === "pool_fee_claim_v2" ||
    input.surfaceKind === "pool_fee_claim_slipstream"
  ) {
    const inbound = walletTransfers
      .map((transfer, index) => ({ transfer, logIndex: transferLogIndex(transfer, index) }))
      .filter(({ transfer }) => asLowerString(transfer.direction) === "receive");
    return inbound.length === 0
      ? []
      : [{
          componentKey: `${txHash}:fee_claim:${uniqueSorted(inbound.map((item) => item.logIndex)).join("-")}`,
          kind: "fee_claim",
          surfaceKind: input.surfaceKind,
          movementLogIndexes: uniqueSorted(inbound.map((item) => item.logIndex)),
          tokenAddresses: uniqueStrings(inbound.map(({ transfer }) => asLowerString(transfer.address))),
        }];
  }

  return [{
    componentKey: `${txHash}:reward_claim`,
    kind: "reward_claim",
    surfaceKind: input.surfaceKind,
    movementLogIndexes: [],
    tokenAddresses: [],
  }];
}
