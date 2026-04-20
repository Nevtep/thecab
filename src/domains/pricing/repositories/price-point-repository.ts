import { and, desc, eq, gte, lte } from "drizzle-orm";

import { buildPriceAssetId, buildPricePointId } from "@/domains/ledger/model/ids";
import { type PricePoint, type PriceSourceKind, type PriceStatus } from "@/domains/pricing/model/price-point";
import { priceAssets, pricePoints } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

type PriceAssetInsert = typeof priceAssets.$inferInsert;
type PricePointInsert = typeof pricePoints.$inferInsert;

export class PricePointRepository {
  constructor(private readonly db: Database) {}

  async upsertPriceAsset(input: {
    chainId: number;
    tokenAddress: string;
    symbol: string | null;
    decimals: number | null;
    providerAssetKey: string | null;
    aliasTargetAssetId: string | null;
    pricingStatus: PriceStatus;
  }) {
    const record: PriceAssetInsert = {
      priceAssetId: buildPriceAssetId(input.chainId, input.tokenAddress),
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      symbol: input.symbol,
      decimals: input.decimals,
      providerAssetKey: input.providerAssetKey,
      aliasTargetAssetId: input.aliasTargetAssetId,
      pricingStatus: input.pricingStatus,
      updatedAt: new Date()
    };

    const [created] = await this.db
      .insert(priceAssets)
      .values(record)
      .onConflictDoUpdate({
        target: priceAssets.priceAssetId,
        set: {
          symbol: record.symbol,
          decimals: record.decimals,
          providerAssetKey: record.providerAssetKey,
          aliasTargetAssetId: record.aliasTargetAssetId,
          pricingStatus: record.pricingStatus,
          updatedAt: new Date()
        }
      })
      .returning();

    return created;
  }

  async findPriceAsset(chainId: number, tokenAddress: string) {
    const [asset] = await this.db
      .select()
      .from(priceAssets)
      .where(
        and(
          eq(priceAssets.chainId, chainId),
          eq(priceAssets.tokenAddress, tokenAddress.toLowerCase())
        )
      )
      .limit(1);

    return asset ?? null;
  }

  async upsertPricePoint(input: Omit<PricePoint, "pricePointId">) {
    const record: PricePointInsert = {
      pricePointId: buildPricePointId(
        input.priceAssetId,
        input.quoteCurrency,
        input.sourceKind,
        input.effectiveAt,
        input.pricingMethod
      ),
      priceAssetId: input.priceAssetId,
      quoteCurrency: input.quoteCurrency,
      sourceKind: input.sourceKind,
      effectiveAt: input.effectiveAt,
      fetchedAt: input.fetchedAt,
      priceValue: input.priceValue,
      resolution: input.resolution,
      confidence: input.confidence,
      pricingMethod: input.pricingMethod,
      providerName: input.providerName,
      providerReference: input.providerReference
    };

    const [created] = await this.db
      .insert(pricePoints)
      .values(record)
      .onConflictDoUpdate({
        target: pricePoints.pricePointId,
        set: {
          fetchedAt: record.fetchedAt,
          priceValue: record.priceValue,
          resolution: record.resolution,
          confidence: record.confidence,
          providerName: record.providerName,
          providerReference: record.providerReference
        }
      })
      .returning();

    return created;
  }

  async findNearestHistoricalPricePoint(input: {
    priceAssetId: string;
    effectiveAt: Date;
    sourceKind?: PriceSourceKind;
  }) {
    const [point] = await this.db
      .select()
      .from(pricePoints)
      .where(
        and(
          eq(pricePoints.priceAssetId, input.priceAssetId),
          eq(pricePoints.sourceKind, input.sourceKind ?? "historical"),
          lte(pricePoints.effectiveAt, input.effectiveAt)
        )
      )
      .orderBy(desc(pricePoints.effectiveAt))
      .limit(1);

    return point ?? null;
  }

  async findFreshCurrentPricePoint(input: {
    priceAssetId: string;
    minFetchedAt: Date;
  }) {
    const [point] = await this.db
      .select()
      .from(pricePoints)
      .where(
        and(
          eq(pricePoints.priceAssetId, input.priceAssetId),
          eq(pricePoints.sourceKind, "current"),
          gte(pricePoints.fetchedAt, input.minFetchedAt)
        )
      )
      .orderBy(desc(pricePoints.fetchedAt))
      .limit(1);

    return point ?? null;
  }

  async listPricePointsForAsset(priceAssetId: string) {
    return this.db
      .select()
      .from(pricePoints)
      .where(eq(pricePoints.priceAssetId, priceAssetId))
      .orderBy(desc(pricePoints.effectiveAt));
  }
}