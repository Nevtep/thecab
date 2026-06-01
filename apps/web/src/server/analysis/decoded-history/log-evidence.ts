import { ERC20_APPROVAL_TOPIC, ERC20_TRANSFER_TOPIC } from "./constants";
import { normalizeAddress, topicAddress } from "./address";
import type {
  MoralisDecodedLog,
  MoralisDecodedTransaction,
  TokenApprovalEvidence,
  TokenTransferEvidence,
} from "./types";

export function decodedParams(log: MoralisDecodedLog) {
  const params: Record<string, string | null> = {};
  for (const param of log.decoded_event?.params ?? []) {
    if (param.name) params[param.name] = param.value ?? null;
  }
  return params;
}

export function transferLogs(tx: MoralisDecodedTransaction): TokenTransferEvidence[] {
  return (tx.logs ?? [])
    .filter((log) => {
      const topic0 = normalizeAddress(log.topic0);
      return topic0 === ERC20_TRANSFER_TOPIC || log.decoded_event?.signature === "Transfer(address,address,uint256)";
    })
    .map((log) => {
      const params = decodedParams(log);
      return {
        token: normalizeAddress(log.address),
        from: normalizeAddress(params.from ?? params.src ?? params._from) || topicAddress(log.topic1),
        to: normalizeAddress(params.to ?? params.dst ?? params._to) || topicAddress(log.topic2),
        value: params.value ?? params.wad ?? params.amount ?? log.data ?? null,
        logIndex: log.log_index,
      };
    });
}

export function approvalLogs(tx: MoralisDecodedTransaction): TokenApprovalEvidence[] {
  return (tx.logs ?? [])
    .filter((log) => {
      const topic0 = normalizeAddress(log.topic0);
      return topic0 === ERC20_APPROVAL_TOPIC || log.decoded_event?.signature === "Approval(address,address,uint256)";
    })
    .map((log) => {
      const params = decodedParams(log);
      return {
        token: normalizeAddress(log.address),
        owner: normalizeAddress(params.owner) || topicAddress(log.topic1),
        spender: normalizeAddress(params.spender) || topicAddress(log.topic2),
        amount: params.amount ?? params.value ?? log.data ?? null,
        logIndex: log.log_index,
      };
    });
}

export function hasInternalError(tx: MoralisDecodedTransaction) {
  return (tx.internal_transactions ?? []).some((internal) => internal.error);
}

export function hasSwapLog(tx: MoralisDecodedTransaction) {
  return (tx.logs ?? []).some((log) => (
    log.decoded_event?.signature?.startsWith("Swap(")
    || String(log.topic0 ?? "").toLowerCase() === "0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67"
  ));
}
