import {
  toEventSelector,
  toEventSignature,
  toFunctionSelector,
  toFunctionSignature,
  type AbiEvent,
  type AbiFunction,
} from "viem";

import type { AbiRegistryEntry, MoralisDecodedTransaction } from "./types";
import { normalizeAddress } from "./address";

export type AbiSelectorMatch = {
  protocol: string;
  label: string;
  address: string;
  contractName: string | null;
  signature: string;
};

export function collectObservedSelectors(transactions: MoralisDecodedTransaction[]) {
  const inputs = new Map<string, Array<{ txIndex: number; txHash: string; toAddress: string }>>();
  const topics = new Map<string, Array<{ txIndex: number; txHash: string; logIndex?: string | number | null; address: string }>>();

  transactions.forEach((tx, index) => {
    const toAddress = normalizeAddress(tx.to_address);
    if (typeof tx.input === "string" && tx.input.length >= 10 && tx.input !== "0x") {
      const selector = tx.input.slice(0, 10).toLowerCase();
      const list = inputs.get(selector) ?? [];
      list.push({ txIndex: index + 1, txHash: tx.hash, toAddress });
      inputs.set(selector, list);
    }

    for (const log of tx.logs ?? []) {
      if (typeof log.topic0 === "string" && log.topic0 !== "0x") {
        const topic = log.topic0.toLowerCase();
        const list = topics.get(topic) ?? [];
        list.push({
          txIndex: index + 1,
          txHash: tx.hash,
          logIndex: log.log_index,
          address: normalizeAddress(log.address),
        });
        topics.set(topic, list);
      }
    }
  });

  return { inputs, topics };
}

export function buildAbiSelectorIndex(registry: Map<string, AbiRegistryEntry>) {
  const byFunctionSelector = new Map<string, AbiSelectorMatch[]>();
  const byEventTopic = new Map<string, AbiSelectorMatch[]>();

  for (const entry of registry.values()) {
    for (const item of entry.abi) {
      if (!item || typeof item !== "object" || !("type" in item)) continue;
      if (item.type === "function") {
        const selector = toFunctionSelector(item as AbiFunction).toLowerCase();
        const list = byFunctionSelector.get(selector) ?? [];
        list.push({
          protocol: entry.protocol,
          label: entry.label,
          address: entry.address,
          contractName: entry.source.contractName,
          signature: toFunctionSignature(item as AbiFunction),
        });
        byFunctionSelector.set(selector, list);
      }
      if (item.type === "event") {
        const topic = toEventSelector(item as AbiEvent).toLowerCase();
        const list = byEventTopic.get(topic) ?? [];
        list.push({
          protocol: entry.protocol,
          label: entry.label,
          address: entry.address,
          contractName: entry.source.contractName,
          signature: toEventSignature(item as AbiEvent),
        });
        byEventTopic.set(topic, list);
      }
    }
  }

  return { byFunctionSelector, byEventTopic };
}

export function summarizeObservedSelectors<T>(
  observed: Map<string, T[]>,
  index: Map<string, AbiSelectorMatch[]>,
) {
  return [...observed.entries()].map(([key, occurrences]) => ({
    key,
    occurrences,
    matches: index.get(key) ?? [],
  }));
}
