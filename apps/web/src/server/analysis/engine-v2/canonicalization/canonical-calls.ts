import type { MoralisDecodedTransaction } from "@/server/analysis/decoded-history";
import { canonicalCalls } from "@/server/db/schema";

import type { EngineV2Db } from "../repositories/types";

export function createRootCanonicalCall(transaction: MoralisDecodedTransaction) {
  const input = transaction.input ?? "";
  const selector = input.startsWith("0x") && input.length >= 10 ? input.slice(0, 10).toLowerCase() : null;

  return {
    txHash: transaction.hash.toLowerCase(),
    callPath: "0",
    targetAddress: transaction.to_address?.toLowerCase() ?? null,
    selector,
    functionName: transaction.decoded_call?.label ?? null,
    decodedArgsJson: transaction.decoded_call ? { decodedCall: transaction.decoded_call } : null,
    rawCallData: input || null,
    decodeStatus: transaction.decoded_call ? "provider_hint" : selector ? "missing_abi" : "no_input",
    decodeConfidence: transaction.decoded_call ? "medium" : "unknown",
  };
}

export async function persistRootCanonicalCall(input: {
  db: EngineV2Db;
  canonicalTransactionId: string;
  chainId: number;
  transaction: MoralisDecodedTransaction;
}) {
  const call = createRootCanonicalCall(input.transaction);
  const [row] = await input.db
    .insert(canonicalCalls)
    .values({
      ...call,
      canonicalTransactionId: input.canonicalTransactionId,
      chainId: input.chainId,
    })
    .onConflictDoUpdate({
      target: [
        canonicalCalls.chainId,
        canonicalCalls.txHash,
        canonicalCalls.callPath,
      ],
      set: {
        targetAddress: call.targetAddress,
        selector: call.selector,
        functionName: call.functionName,
        decodedArgsJson: call.decodedArgsJson,
        rawCallData: call.rawCallData,
        decodeStatus: call.decodeStatus,
        decodeConfidence: call.decodeConfidence,
      },
    })
    .returning();

  return row;
}
