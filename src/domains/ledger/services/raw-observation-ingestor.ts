import { createHash } from "node:crypto";

import { type Hex } from "viem";
import { base } from "viem/chains";

import { buildRawObservationId } from "@/domains/ledger/model/ids";
import { getBasePublicClient, getBaseTraceClient } from "@/infrastructure/chain/clients";
import { normalizeJsonValue } from "@/infrastructure/serialization/json";
import { type FixtureObservation } from "@/lib/fixture-loader";

export type RawObservationSeed = {
  rawObservationId: string;
  sourceType: "block_header" | "transaction" | "receipt" | "log" | "trace_frame";
  chainId: number;
  blockNumber: bigint | null;
  blockHash: string | null;
  txHash: string | null;
  logIndex: number | null;
  tracePath: string | null;
  contractAddress: string | null;
  payloadJson: unknown;
  payloadHash: string;
};

function hashPayload(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(normalizeJsonValue(payload)))
    .digest("hex");
}

export class RawObservationIngestor {
  async hydrateTransaction(
    txHash: Hex,
    fixtureObservations: FixtureObservation[] = []
  ): Promise<RawObservationSeed[]> {
    const fixtureMatches = fixtureObservations.filter(
      (observation) => observation.txHash?.toLowerCase() === txHash.toLowerCase()
    );

    if (fixtureMatches.length > 0) {
      return fixtureMatches.map((observation) => ({
        rawObservationId:
          observation.rawObservationId ??
          buildRawObservationId({
            sourceType: observation.sourceType,
            chainId: observation.chainId,
            txHash: observation.txHash,
            logIndex: observation.logIndex,
            tracePath: observation.tracePath
          }),
        sourceType: observation.sourceType,
        chainId: observation.chainId,
        blockNumber: observation.blockNumber == null ? null : BigInt(observation.blockNumber),
        blockHash: observation.blockHash,
        txHash: observation.txHash,
        logIndex: observation.logIndex ?? null,
        tracePath: observation.tracePath ?? null,
        contractAddress: observation.contractAddress ?? null,
        payloadJson: normalizeJsonValue(observation.payloadJson),
        payloadHash: observation.payloadHash ?? hashPayload(observation.payloadJson)
      }));
    }

    const publicClient = getBasePublicClient();
    const traceClient = getBaseTraceClient();

    const [transaction, receipt] = await Promise.all([
      publicClient.getTransaction({ hash: txHash }),
      publicClient.getTransactionReceipt({ hash: txHash })
    ]);
    const block = await publicClient.getBlock({ blockHash: receipt.blockHash });
    const chainId = publicClient.chain?.id ?? base.id;

    const observations: RawObservationSeed[] = [
      this.createSeed({
        sourceType: "block_header",
        chainId,
        blockNumber: block.number,
        blockHash: block.hash,
        txHash,
        payloadJson: block
      }),
      this.createSeed({
        sourceType: "transaction",
        chainId,
        blockNumber: transaction.blockNumber,
        blockHash: transaction.blockHash,
        txHash,
        payloadJson: transaction
      }),
      this.createSeed({
        sourceType: "receipt",
        chainId,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        txHash,
        payloadJson: receipt
      })
    ];

    for (const log of receipt.logs) {
      observations.push(
        this.createSeed({
          sourceType: "log",
          chainId,
          blockNumber: log.blockNumber,
          blockHash: log.blockHash,
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          contractAddress: log.address,
          payloadJson: log
        })
      );
    }

    if (traceClient) {
      try {
        const tracePayload = await (traceClient as {
          request: (args: { method: string; params: unknown[] }) => Promise<unknown>;
        }).request({
          method: "debug_traceTransaction",
          params: [txHash, {}]
        });

        observations.push(
          this.createSeed({
            sourceType: "trace_frame",
            chainId,
            blockNumber: receipt.blockNumber,
            blockHash: receipt.blockHash,
            txHash,
            tracePath: "0",
            payloadJson: tracePayload
          })
        );
      } catch {
        // Trace support is optional and should not block raw observation hydration.
      }
    }

    return observations;
  }

  private createSeed(input: {
    sourceType: RawObservationSeed["sourceType"];
    chainId: number;
    blockNumber: bigint | null;
    blockHash: string | null;
    txHash: string | null;
    payloadJson: unknown;
    logIndex?: number | null;
    tracePath?: string | null;
    contractAddress?: string | null;
  }): RawObservationSeed {
    return {
      rawObservationId: buildRawObservationId({
        sourceType: input.sourceType,
        chainId: input.chainId,
        txHash: input.txHash,
        logIndex: input.logIndex,
        tracePath: input.tracePath
      }),
      sourceType: input.sourceType,
      chainId: input.chainId,
      blockNumber: input.blockNumber,
      blockHash: input.blockHash,
      txHash: input.txHash,
      logIndex: input.logIndex ?? null,
      tracePath: input.tracePath ?? null,
      contractAddress: input.contractAddress ?? null,
      payloadJson: normalizeJsonValue(input.payloadJson),
      payloadHash: hashPayload(input.payloadJson)
    };
  }
}