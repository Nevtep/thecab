import { decodeFunctionData } from "viem";

import type { AbiRegistryEntry, Address, MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { decodeTransactionInput } from "@/server/analysis/decoded-history";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";

export type EngineV2DecodedCall = {
  callPath: string;
  targetAddress: Address | "";
  selector: string;
  functionName: string | null;
  args: readonly unknown[];
  decodeStatus: "decoded" | "missing_abi" | "decode_failed";
  decodeConfidence: "high" | "low" | "unknown";
  error: string | null;
  rawCallData: string | null;
  entry: AbiRegistryEntry | null;
};

export function decodeCanonicalTransactionCalls(input: {
  tx: MoralisDecodedTransaction;
  registry: Map<Address, AbiRegistryEntry>;
}): EngineV2DecodedCall[] {
  const root = decodeTransactionInput(input.tx, input.registry);
  const targetAddress = normalizeAddress(input.tx.to_address);
  const calls: EngineV2DecodedCall[] = [{
    callPath: "0",
    targetAddress,
    selector: root.selector,
    functionName: root.functionName,
    args: root.args,
    decodeStatus: root.functionName ? "decoded" : root.entry ? "decode_failed" : "missing_abi",
    decodeConfidence: root.functionName ? "high" : "unknown",
    error: root.error,
    rawCallData: input.tx.input ?? null,
    entry: root.entry,
  }];

  for (const [index, nestedCall] of nestedCallPayloads(root.args, targetAddress).entries()) {
    const entry = (nestedCall.targetAddress ? input.registry.get(nestedCall.targetAddress) : null) ?? root.entry;
    if (!entry) {
      calls.push({
        callPath: `0.${index}`,
        targetAddress: nestedCall.targetAddress,
        selector: nestedCall.rawCallData.slice(0, 10).toLowerCase(),
        functionName: null,
        args: [],
        decodeStatus: "missing_abi",
        decodeConfidence: "unknown",
        error: null,
        rawCallData: nestedCall.rawCallData,
        entry: null,
      });
      continue;
    }

    try {
      const decoded = decodeFunctionData({ abi: entry.abi, data: nestedCall.rawCallData });
      calls.push({
        callPath: `0.${index}`,
        targetAddress: nestedCall.targetAddress,
        selector: nestedCall.rawCallData.slice(0, 10).toLowerCase(),
        functionName: decoded.functionName,
        args: decoded.args ?? [],
        decodeStatus: "decoded",
        decodeConfidence: "high",
        error: null,
        rawCallData: nestedCall.rawCallData,
        entry,
      });
    } catch (error) {
      calls.push({
        callPath: `0.${index}`,
        targetAddress: nestedCall.targetAddress,
        selector: nestedCall.rawCallData.slice(0, 10).toLowerCase(),
        functionName: null,
        args: [],
        decodeStatus: "decode_failed",
        decodeConfidence: "low",
        error: error instanceof Error ? error.message : "decode_failed",
        rawCallData: nestedCall.rawCallData,
        entry,
      });
    }
  }

  return calls;
}

function nestedCallPayloads(args: readonly unknown[], fallbackTargetAddress: Address | "") {
  const bytesArray = args.find((arg): arg is `0x${string}`[] => (
    Array.isArray(arg) && arg.every((item) => typeof item === "string" && item.startsWith("0x") && item.length > 42)
  ));
  if (!bytesArray) return [];

  const targetArray = args.find((arg): arg is string[] => (
    Array.isArray(arg) && arg.every((item) => typeof item === "string" && /^0x[a-fA-F0-9]{40}$/.test(item))
  ));

  return bytesArray.map((rawCallData, index) => ({
    rawCallData,
    targetAddress: normalizeAddress(targetArray?.[index]) || fallbackTargetAddress,
  }));
}
