import { approvalLogs, transferLogs } from "./log-evidence";
import { normalizeAddress } from "./address";
import type {
  AbiRegistryEntry,
  Address,
  MoralisDecodedTransaction,
} from "./types";
import { registryKind, type ContractSeed } from "./abi-registry";

export type ContractDiscoveryCandidate = ContractSeed & {
  reason: string;
};

export function discoverContractCandidatesFromDecodedTx(input: {
  tx: MoralisDecodedTransaction;
  walletAddress: Address;
  registry: Map<Address, AbiRegistryEntry>;
}): ContractDiscoveryCandidate[] {
  const walletAddress = normalizeAddress(input.walletAddress);
  const candidates = new Map<Address, ContractDiscoveryCandidate>();

  const add = (candidate: ContractDiscoveryCandidate) => {
    const address = normalizeAddress(candidate.address);
    if (!address || input.registry.has(address)) return;
    candidates.set(address, { ...candidate, address });
  };

  const toAddress = normalizeAddress(input.tx.to_address);
  const selector = typeof input.tx.input === "string" && input.tx.input.length >= 10
    ? input.tx.input.slice(0, 10).toLowerCase()
    : "0x";

  if (toAddress && selector !== "0x" && !input.registry.has(toAddress)) {
    add({
      protocol: "observed",
      label: "Observed Contract",
      address: toAddress,
      expectedKind: "observed-contract",
      reason: `wallet transaction target selector ${selector}`,
    });
  }

  for (const approval of approvalLogs(input.tx)) {
    if (approval.owner !== walletAddress || !approval.spender) continue;
    add({
      protocol: "observed",
      label: "Observed Approval Spender",
      address: approval.spender,
      expectedKind: "observed-contract",
      reason: `wallet approved token ${approval.token}`,
    });
  }

  for (const transfer of transferLogs(input.tx)) {
    if (!transfer.token) continue;
    add({
      protocol: "observed-token",
      label: "Observed Token",
      address: transfer.token,
      expectedKind: "token",
      reason: "token transfer in wallet history",
    });
  }

  return [...candidates.values()];
}

export function shouldFetchAbiForCandidate(candidate: ContractDiscoveryCandidate) {
  if (candidate.expectedKind === "token") return false;
  return true;
}

export function describeRegistryEntry(entry: AbiRegistryEntry | null) {
  if (!entry) return null;
  return {
    address: entry.address,
    label: entry.label,
    protocol: entry.protocol,
    contractName: entry.source.contractName,
    kind: registryKind(entry),
  };
}
