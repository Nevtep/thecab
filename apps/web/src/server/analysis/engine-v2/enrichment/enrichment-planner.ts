import type { EngineV2Classification } from "@/server/analysis/engine-v2/classification";

import type { EngineV2EnrichmentNeedInput } from "./enrichment.repository";

const REASON_TO_NEED: Record<string, string> = {
  missing_abi: "abi",
  missing_selector: "selector",
  missing_event_topic: "log_decode",
  missing_token_metadata: "token_metadata",
  missing_historical_price: "historical_price",
  missing_pool_definition: "pool_definition",
  missing_lock_origin: "lock_identity",
  missing_distributor_pool_link: "distributor_pool_link",
  missing_strategy_identity: "strategy_state",
  missing_explicit_evidence: "transaction_decoded_backfill",
};

export function planEnrichmentNeedsForClassification(input: {
  chainId: number;
  walletAddress: string;
  txHash: string;
  classification: EngineV2Classification;
  sourceDomainEventId?: string | null;
}) {
  if (input.classification.coverageStatus === "full" || input.classification.coverageStatus === "excluded") {
    return [] satisfies EngineV2EnrichmentNeedInput[];
  }

  const reasonCodes = input.classification.reasonCodes.length > 0
    ? input.classification.reasonCodes
    : ["missing_explicit_evidence"];

  const needs = new Map<string, EngineV2EnrichmentNeedInput>();
  const metadata = input.classification.metadataJson ?? {};
  const distributorAddresses = Array.from(new Set([
    typeof metadata.distributorAddress === "string" ? metadata.distributorAddress.toLowerCase() : null,
    ...(Array.isArray(metadata.distributorAddresses)
      ? metadata.distributorAddresses.filter((value): value is string => typeof value === "string").map((value) => value.toLowerCase())
      : []),
  ].filter((value): value is string => Boolean(value))));
  for (const reasonCode of reasonCodes) {
    const needType = REASON_TO_NEED[reasonCode] ?? "manual_review";
    if (needType === "distributor_pool_link" && distributorAddresses.length > 0) {
      for (const distributorAddress of distributorAddresses) {
        needs.set(`${needType}:distributor:${distributorAddress}`, {
          chainId: input.chainId,
          walletAddress: input.walletAddress,
          sourceDomainEventId: input.sourceDomainEventId ?? null,
          needType,
          targetType: "distributor",
          targetId: distributorAddress,
          reasonCodes: [reasonCode],
          requestJson: {
            eventType: input.classification.eventType,
            coverageStatus: input.classification.coverageStatus,
            txHash: input.txHash.toLowerCase(),
            distributorAddress,
          },
        });
      }
      continue;
    }
    const targetType = needType === "transaction_decoded_backfill" ? "transaction" : input.classification.eventFamily;
    needs.set(`${needType}:${targetType}:${input.txHash}`, {
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      sourceDomainEventId: input.sourceDomainEventId ?? null,
      needType,
      targetType,
      targetId: input.txHash.toLowerCase(),
      reasonCodes: [reasonCode],
      requestJson: {
        eventType: input.classification.eventType,
        coverageStatus: input.classification.coverageStatus,
      },
    });
  }

  return [...needs.values()];
}

