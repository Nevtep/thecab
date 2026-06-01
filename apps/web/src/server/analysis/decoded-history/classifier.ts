import { decodeFunctionData } from "viem";

import { normalizeAddress, normalizeTxHash, shortHash } from "./address";
import { registryKind } from "./abi-registry";
import { CORE_BASE_TOKENS } from "./constants";
import { approvalLogs, hasInternalError, hasSwapLog, transferLogs } from "./log-evidence";
import type {
  AbiRegistryEntry,
  Address,
  ClassifiedDecodedTransaction,
  DecodedTransactionClassification,
  DecodedTxInput,
  MoralisDecodedTransaction,
  TokenApprovalEvidence,
} from "./types";

export function decodeTransactionInput(
  tx: MoralisDecodedTransaction,
  registry: Map<Address, AbiRegistryEntry>,
): DecodedTxInput {
  const to = normalizeAddress(tx.to_address);
  const input = tx.input ?? "0x";
  const selector = input.length >= 10 ? input.slice(0, 10).toLowerCase() : "0x";
  const entry = to ? registry.get(to) : undefined;

  if (entry && input !== "0x") {
    try {
      const decoded = decodeFunctionData({ abi: entry.abi, data: input as `0x${string}` });
      return {
        selector,
        entry,
        functionName: decoded.functionName,
        args: decoded.args ?? [],
        error: null,
      };
    } catch (error) {
      return {
        selector,
        entry,
        functionName: null,
        args: [],
        error: error instanceof Error ? error.message : "decode_failed",
      };
    }
  }

  return {
    selector,
    entry: null,
    functionName: null,
    args: [],
    error: null,
  };
}

export function classifyDecodedTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): DecodedTransactionClassification {
  const tx = input.tx;
  const walletAddress = normalizeAddress(input.walletAddress);
  const decoded = decodeTransactionInput(tx, input.registry);
  const from = normalizeAddress(tx.from_address);
  const to = normalizeAddress(tx.to_address);
  const approvals = approvalLogs(tx);
  const transfers = transferLogs(tx);
  const inboundTransfers = transfers.filter((transfer) => transfer.to === walletAddress);
  const outboundTransfers = transfers.filter((transfer) => transfer.from === walletAddress);
  const initiatedByWallet = from === walletAddress;

  if (tx.receipt_status !== "1") {
    return {
      classification: "failed_transaction",
      confidence: "high",
      reason: `receipt_status=${tx.receipt_status}${hasInternalError(tx) ? " with internal error" : ""}`,
      needsResolution: false,
    };
  }

  if (decoded.functionName && decoded.entry) {
    const result = classifyDecodedFunction(tx, decoded);
    if (result.classification !== "protocol_contract_call_unmapped") return result;
  }

  if (approvals.length > 0 && approvals.some((approval) => approval.owner === walletAddress)) {
    const approval = approvals.find((item) => item.owner === walletAddress) ?? approvals[0];
    return classifyApproval(approval, input.registry);
  }

  if (decoded.selector === "0xa9059cbb" && outboundTransfers.length > 0) {
    return {
      classification: "cash_out_token_transfer",
      confidence: "high",
      reason: `ERC20 transfer of ${CORE_BASE_TOKENS.get(to) ?? shortHash(to)} from wallet`,
      needsResolution: false,
    };
  }

  if (initiatedByWallet && decoded.selector === "0x" && BigInt(tx.value ?? "0") > 0n) {
    return {
      classification: "cash_out_native",
      confidence: "high",
      reason: "native transfer from wallet",
      needsResolution: false,
    };
  }

  if (!initiatedByWallet && to === walletAddress && BigInt(tx.value ?? "0") > 0n && transfers.length === 0) {
    return {
      classification: "cash_in_native",
      confidence: "high",
      reason: "native transfer into wallet",
      needsResolution: false,
    };
  }

  if (!initiatedByWallet && to === walletAddress && decoded.selector === "0x" && BigInt(tx.value ?? "0") === 0n && transfers.length === 0) {
    return {
      classification: "zero_value_external_noop",
      confidence: "high",
      reason: "external zero-value transaction to wallet; no logs, no value effect",
      needsResolution: false,
    };
  }

  if (hasSwapLog(tx) && outboundTransfers.length > 0 && inboundTransfers.length > 0) {
    return {
      classification: "swap",
      confidence: "medium",
      reason: "Swap logs and wallet token movements without decoded router ABI",
      needsResolution: true,
    };
  }

  if (!initiatedByWallet && inboundTransfers.length > 0 && outboundTransfers.length === 0) {
    return {
      classification: "inbound_token_transfer_needs_counterparty_label",
      confidence: "low",
      reason: "token arrived without wallet-initiated protocol call; needs counterparty/token metadata to distinguish cash-in vs airdrop/spam",
      needsResolution: true,
    };
  }

  if (initiatedByWallet && outboundTransfers.length > 0 && inboundTransfers.length === 0) {
    return {
      classification: "cash_out_token_transfer",
      confidence: "medium",
      reason: "wallet sent token without recognized protocol ABI",
      needsResolution: true,
    };
  }

  if (decoded.entry) return classifyDecodedFunction(tx, decoded);

  return {
    classification: "unclassified_transaction",
    confidence: "low",
    reason: `No ABI/rule for to=${to || "contract creation/none"} selector=${decoded.selector}`,
    needsResolution: true,
  };
}

export function buildClassifiedDecodedTransaction(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): ClassifiedDecodedTransaction {
  const decoded = decodeTransactionInput(input.tx, input.registry);
  const classification = classifyDecodedTransaction(input);
  const walletAddress = normalizeAddress(input.walletAddress);
  const transfers = transferLogs(input.tx);
  return {
    hash: normalizeTxHash(input.tx.hash) || input.tx.hash as `0x${string}`,
    timestamp: input.tx.block_timestamp ?? null,
    blockNumber: input.tx.block_number ? Number(input.tx.block_number) : null,
    transactionIndex: input.tx.transaction_index ? Number(input.tx.transaction_index) : null,
    fromAddress: normalizeAddress(input.tx.from_address),
    toAddress: normalizeAddress(input.tx.to_address),
    selector: decoded.selector,
    contractLabel: decoded.entry?.label ?? null,
    contractName: decoded.entry?.source?.contractName ?? null,
    decodedFunction: decoded.functionName,
    decodedArgs: decoded.args,
    transferCount: transfers.length,
    inboundTransferCount: transfers.filter((transfer) => transfer.to === walletAddress).length,
    outboundTransferCount: transfers.filter((transfer) => transfer.from === walletAddress).length,
    approvalCount: approvalLogs(input.tx).length,
    classification: classification.classification,
    confidence: classification.confidence,
    reason: classification.reason,
    needsResolution: classification.needsResolution,
  };
}

function classifyApproval(
  approval: TokenApprovalEvidence,
  registry: Map<Address, AbiRegistryEntry>,
): DecodedTransactionClassification {
  const spenderEntry = approval.spender ? registry.get(approval.spender) : null;
  const kind = registryKind(spenderEntry ?? null);
  if (kind === "strategy-wrapper") return done("approval_strategy_wrapper", "high", "Approved token spend by Mellow LpWrapper");
  if (kind === "router") return done("approval_router", "high", "Approved token spend by router");
  if (kind === "position-manager") return done("approval_position_manager", "high", "Approved token/NFT spend by position manager");
  if (kind === "governance-lock") return done("approval_governance_lock", "high", "Approved AERO spend by VotingEscrow");
  if (spenderEntry?.label) return done("approval_protocol_contract", "high", `Approved token spend by ${spenderEntry.label}`);
  return done("approval_unknown_spender", "medium", `Approval spender ${approval.spender || "unknown"} is not in ABI registry`, true);
}

function classifyDecodedFunction(
  tx: MoralisDecodedTransaction,
  decoded: DecodedTxInput,
): DecodedTransactionClassification {
  const kind = registryKind(decoded.entry);
  const fn = decoded.functionName;
  const nested = nestedMulticallNames(decoded);

  if (kind === "strategy-wrapper") {
    if (fn === "mint") return done("strategy_deposit", "high_action_partial_accounting", `${decoded.entry?.label} ${fn}`, true);
    if (fn === "withdraw") return done("strategy_withdraw", "high_action_partial_accounting", `${decoded.entry?.label} ${fn}`, true);
    if (fn === "getRewards") return done("strategy_reward_claim", "high_action", `${decoded.entry?.label} ${fn}`);
    if (fn === "transfer") return done("strategy_share_transfer", "high_action", `${decoded.entry?.label} ${fn}`);
  }

  if (decoded.entry?.label === "Voter") {
    if (fn === "vote") return done("governance_vote", "high", `Voter.vote tokenId=${String(decoded.args[0] ?? "unknown")}`);
    if (fn === "poke") return done("governance_poke", "high", `Voter.poke tokenId=${String(decoded.args[0] ?? "unknown")}`);
    if (fn === "depositManaged") return done("governance_deposit_managed", "high_action_partial_semantics", `Voter.depositManaged tokenId=${String(decoded.args[0])} mTokenId=${String(decoded.args[1])}`, true);
    if (fn === "claimBribes") return done("governance_bribe_claim", "high_action_partial_breakdown", "Voter.claimBribes", true);
    if (fn === "claimFees") return done("governance_fee_claim", "high_action_partial_breakdown", "Voter.claimFees", true);
  }

  if (decoded.entry?.label === "VotingEscrow") {
    if (fn === "createLock") return done("governance_lock_created", "high", "VotingEscrow.createLock");
    if (fn === "increaseAmount") return done("governance_lock_increase", "high", "VotingEscrow.increaseAmount");
    if (fn === "increaseUnlockTime") return done("governance_lock_extend", "high", "VotingEscrow.increaseUnlockTime");
    if (fn === "depositManaged") return done("governance_deposit_managed", "high_action_partial_semantics", "VotingEscrow.depositManaged", true);
    if (fn === "withdraw") return done("governance_lock_withdraw", "high", "VotingEscrow.withdraw");
  }

  if (decoded.entry?.label === "RewardsDistributor" && fn === "claim") {
    return done("governance_rebase_claim", "high_action_partial_value_effect", "RewardsDistributor.claim", true);
  }

  if (kind === "position-manager") {
    const note = `NonfungiblePositionManager ${fn}${nested.length ? ` [${nested.join(", ")}]` : ""}`;
    if (fn === "mint" || nested.includes("mint")) return done("manual_position_created", "high_action_partial_accounting", note, true);
    if (fn === "increaseLiquidity" || nested.includes("increaseLiquidity")) return done("manual_position_increase", "high_action_partial_accounting", note, true);
    if (fn === "collect" || nested.includes("collect")) return done("manual_position_fee_claim", "high_action_partial_breakdown", note, true);
    if (fn === "decreaseLiquidity" || nested.includes("decreaseLiquidity") || fn === "burn" || nested.includes("burn")) {
      return done("manual_position_withdraw", "high_action_partial_accounting", note, true);
    }
    if (fn === "approve" || fn === "setApprovalForAll") return done("manual_position_approval", "high", note);
  }

  if (kind === "gauge") {
    if (fn === "deposit") return done("manual_gauge_stake", "high_action_partial_accounting", `${decoded.entry?.source.contractName}.deposit`, true);
    if (fn === "withdraw") return done("manual_gauge_unstake", "high_action_partial_accounting", `${decoded.entry?.source.contractName}.withdraw`, true);
    if (fn === "getReward") return done("manual_gauge_reward_claim", "high_action_partial_breakdown", `${decoded.entry?.source.contractName}.getReward`, true);
  }

  if (kind === "pool") {
    if (fn === "claimFees") return done("manual_pool_fee_claim", "high_action_partial_breakdown", "Pool.claimFees", true);
    if (fn === "mint" || fn === "burn" || fn === "swap") return done("manual_pool_direct_action", "medium", `Pool.${fn}`, true);
  }

  if (kind === "router") {
    if (fn === "execute") return done(hasSwapLog(tx) ? "swap" : "router_execute", hasSwapLog(tx) ? "high" : "medium", `${decoded.entry?.label}.execute`);
    if (fn === "addLiquidity") return done("manual_pool_deposit_router", "high_action_partial_accounting", "Router.addLiquidity", true);
    if (fn === "removeLiquidity") return done("manual_pool_withdraw_router", "high_action_partial_accounting", "Router.removeLiquidity", true);
    if (fn?.toLowerCase().includes("swap")) return done("swap", "high", `Router.${fn}`);
  }

  return done("protocol_contract_call_unmapped", "medium", `${decoded.entry?.label ?? "registry contract"}.${fn ?? decoded.selector}`, true);
}

function nestedMulticallNames(decoded: DecodedTxInput) {
  if (decoded.functionName !== "multicall" || !decoded.entry) return [];
  const calls = Array.isArray(decoded.args[0]) ? decoded.args[0] as `0x${string}`[] : [];
  return calls.map((call) => {
    try {
      return decodeFunctionData({ abi: decoded.entry!.abi, data: call }).functionName;
    } catch {
      return `unknown:${String(call).slice(0, 10)}`;
    }
  });
}

function done(
  classification: string,
  confidence: DecodedTransactionClassification["confidence"],
  reason: string,
  needsResolution = false,
): DecodedTransactionClassification {
  return {
    classification,
    confidence,
    reason,
    needsResolution,
  };
}
