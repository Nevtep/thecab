import {
  buildClassifiedDecodedTransaction,
  type AbiRegistryEntry,
  type Address,
  type MoralisDecodedTransaction,
} from "@/server/analysis/decoded-history";
import { ENGINE_V2_VERSION } from "@/server/analysis/engine-v2/types";
import { engineV2ClassifiedTransactions } from "@/server/db/schema";

function toJsonSafeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map((item) => toJsonSafeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJsonSafeValue(item)]));
  }
  return value ?? null;
}

export function toClassifiedTransactionValues(input: {
  canonicalTransactionId: string;
  chainId: number;
  walletAddress: Address;
  tx: MoralisDecodedTransaction;
  registry: Map<Address, AbiRegistryEntry>;
  sequenceIndex: number;
}) {
  const snapshot = buildClassifiedDecodedTransaction({
    tx: input.tx,
    walletAddress: input.walletAddress,
    registry: input.registry,
  });

  return {
    canonicalTransactionId: input.canonicalTransactionId,
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    txHash: snapshot.hash.toLowerCase(),
    occurredAt: snapshot.timestamp ? new Date(snapshot.timestamp) : null,
    blockNumber: snapshot.blockNumber === null ? null : String(snapshot.blockNumber),
    transactionIndex: snapshot.transactionIndex,
    sequenceIndex: input.sequenceIndex,
    fromAddress: snapshot.fromAddress || null,
    toAddress: snapshot.toAddress || null,
    selector: snapshot.selector,
    contractLabel: snapshot.contractLabel,
    contractName: snapshot.contractName,
    decodedFunction: snapshot.decodedFunction,
    decodedArgsJson: toJsonSafeValue(Array.from(snapshot.decodedArgs)) as unknown[],
    transferCount: snapshot.transferCount,
    inboundTransferCount: snapshot.inboundTransferCount,
    outboundTransferCount: snapshot.outboundTransferCount,
    approvalCount: snapshot.approvalCount,
    classification: snapshot.classification,
    classifierVersion: ENGINE_V2_VERSION,
    confidence: snapshot.confidence,
    reason: snapshot.reason,
    needsResolution: snapshot.needsResolution,
    updatedAt: new Date(),
  } satisfies typeof engineV2ClassifiedTransactions.$inferInsert;
}