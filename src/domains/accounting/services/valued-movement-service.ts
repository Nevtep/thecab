import Decimal from "decimal.js";

import { type ValuedMovement } from "@/domains/accounting/model/valued-movement";
import { PriceSelectionService } from "@/domains/pricing/services/price-selection-service";
import { PriceNormalizationService } from "@/domains/pricing/services/price-normalization-service";
import { type PriceProvider } from "@/domains/pricing/contracts/price-provider";
import { PricePointRepository } from "@/domains/pricing/repositories/price-point-repository";

const TEN = new Decimal(10);

function normalizeAmount(amountRaw: string, decimals: number) {
  return new Decimal(amountRaw).div(TEN.pow(decimals));
}

export class ValuedMovementService {
  private readonly selectionService = new PriceSelectionService();
  private readonly normalizationService = new PriceNormalizationService();

  constructor(
    private readonly pricePointRepository: PricePointRepository,
    private readonly priceProvider: PriceProvider
  ) {}

  async valueMovements(input: {
    records: Array<{
      ledgerRecordId: string;
      poolId: string | null;
      strategyId: string | null;
      positionInstanceId: string | null;
      txHash: string;
      timestamp: Date;
      eventType: string;
    }>;
    movementsByRecordId: Map<
      string,
      Array<{
        assetMovementId: string;
        tokenAddress: string;
        symbol: string | null;
        amountRaw: string;
        decimals: number;
        direction: string;
        movementRole: string;
      }>
    >;
    chainId: number;
  }) {
    const results: ValuedMovement[] = [];

    for (const record of input.records) {
      const movements = input.movementsByRecordId.get(record.ledgerRecordId) ?? [];
      for (const movement of movements) {
        const normalizedAsset = this.normalizationService.normalizeAsset({
          chainId: input.chainId,
          tokenAddress: movement.tokenAddress,
          symbol: movement.symbol,
          decimals: movement.decimals
        });

        const asset = await this.pricePointRepository.upsertPriceAsset(normalizedAsset);
        let historicalPoint = await this.pricePointRepository.findNearestHistoricalPricePoint({
          priceAssetId: asset.priceAssetId,
          effectiveAt: record.timestamp
        });

        if (!historicalPoint) {
          const providerQuote = await this.priceProvider.getHistoricalPrice({
            asset: this.normalizationService.buildProviderAssetRef({
              chainId: input.chainId,
              tokenAddress: normalizedAsset.tokenAddress,
              symbol: normalizedAsset.symbol,
              providerAssetKey: normalizedAsset.providerAssetKey
            }),
            effectiveAt: record.timestamp
          });

          if (providerQuote) {
            historicalPoint = await this.pricePointRepository.upsertPricePoint(
              this.normalizationService.normalizeProviderQuote({
                priceAssetId: asset.priceAssetId,
                quote: providerQuote,
                pricingMethod: this.normalizationService.determinePricingMethod({
                  symbol: normalizedAsset.symbol,
                  providerAssetKey: normalizedAsset.providerAssetKey
                })
              })
            );
          }
        }

        const selection = this.selectionService.selectHistoricalPricePoint({
          subjectId: movement.assetMovementId,
          eventTimestamp: record.timestamp,
          point: historicalPoint
            ? {
                pricePointId: historicalPoint.pricePointId,
                effectiveAt: historicalPoint.effectiveAt,
                confidence: historicalPoint.confidence
              }
            : null
        });

        const amount = normalizeAmount(movement.amountRaw, movement.decimals);
        const priceUsd = historicalPoint ? new Decimal(historicalPoint.priceValue) : null;
        const eventValueUsd = priceUsd ? amount.mul(priceUsd) : null;

        results.push({
          assetMovementId: movement.assetMovementId,
          ledgerRecordId: record.ledgerRecordId,
          txHash: record.txHash,
          timestamp: record.timestamp,
          eventType: record.eventType,
          poolId: record.poolId,
          strategyId: record.strategyId,
          positionInstanceId: record.positionInstanceId,
          tokenAddress: movement.tokenAddress.toLowerCase(),
          symbol: movement.symbol,
          amountRaw: movement.amountRaw,
          decimals: movement.decimals,
          amount: amount.toString(),
          direction: movement.direction === "in" ? "in" : "out",
          movementRole: movement.movementRole,
          priceAssetId: asset.priceAssetId,
          pricePointId: historicalPoint?.pricePointId ?? null,
          priceUsd: priceUsd?.toString() ?? null,
          eventValueUsd: eventValueUsd?.toString() ?? null,
          coverage: selection.coverage
        });
      }
    }

    return results;
  }
}