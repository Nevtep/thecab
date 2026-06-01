import {
  toEventSelector,
  toEventSignature,
  toFunctionSelector,
  toFunctionSignature,
  type AbiEvent,
  type AbiFunction,
} from "viem";

export type EngineV2AbiSelectorRow = {
  contractAbiId: string;
  chainId: number;
  address: string;
  selectorOrTopic: string;
  signature: string;
  fragmentType: "function" | "event";
  fragmentJson: Record<string, unknown>;
};

export function selectorEventRowsFromAbi(input: {
  contractAbiId: string;
  chainId: number;
  address: string;
  abi: readonly unknown[];
}) {
  const rows: EngineV2AbiSelectorRow[] = [];
  for (const fragment of input.abi) {
    if (!fragment || typeof fragment !== "object" || !("type" in fragment)) continue;
    if (fragment.type === "function") {
      const abiFunction = fragment as AbiFunction;
      rows.push({
        contractAbiId: input.contractAbiId,
        chainId: input.chainId,
        address: input.address.toLowerCase(),
        selectorOrTopic: toFunctionSelector(abiFunction).toLowerCase(),
        signature: toFunctionSignature(abiFunction),
        fragmentType: "function",
        fragmentJson: fragment as Record<string, unknown>,
      });
    }
    if (fragment.type === "event") {
      const abiEvent = fragment as AbiEvent;
      rows.push({
        contractAbiId: input.contractAbiId,
        chainId: input.chainId,
        address: input.address.toLowerCase(),
        selectorOrTopic: toEventSelector(abiEvent).toLowerCase(),
        signature: toEventSignature(abiEvent),
        fragmentType: "event",
        fragmentJson: fragment as Record<string, unknown>,
      });
    }
  }

  return rows;
}

