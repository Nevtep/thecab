import { buildPriceAssetId } from "@/domains/ledger/model/ids";
import { type ProviderPriceQuote, type PriceProviderAssetRef } from "@/domains/pricing/contracts/price-provider";
import { type PriceMethod, type PriceStatus } from "@/domains/pricing/model/price-point";

const STABLE_SYMBOLS = new Set(["USDC", "USDBC", "USD+"]);
const WRAPPED_ALIASES: Record<string, string> = {
  weth: "eth"
};

export class PriceNormalizationService {
  normalizeAsset(input: {
    chainId: number;
    tokenAddress: string;
    symbol: string | null;
    decimals: number | null;
  }) {
    const normalizedAddress = input.tokenAddress.toLowerCase();
    const normalizedSymbol = input.symbol?.toUpperCase() ?? null;

    let pricingStatus: PriceStatus = "direct";
    let providerAssetKey: string | null = normalizedSymbol?.toLowerCase() ?? normalizedAddress;
    let aliasTargetAssetId: string | null = null;

    if (normalizedSymbol && STABLE_SYMBOLS.has(normalizedSymbol)) {
      pricingStatus = "alias";
      providerAssetKey = "usd-coin";
      aliasTargetAssetId = buildPriceAssetId(input.chainId, "0xusdc");
    } else if (normalizedSymbol) {
      const aliasKey = WRAPPED_ALIASES[normalizedSymbol.toLowerCase()];
      if (aliasKey) {
        pricingStatus = "alias";
        providerAssetKey = aliasKey;
      }
    }

    return {
      priceAssetId: buildPriceAssetId(input.chainId, normalizedAddress),
      chainId: input.chainId,
      tokenAddress: normalizedAddress,
      symbol: normalizedSymbol,
      decimals: input.decimals,
      providerAssetKey,
      aliasTargetAssetId,
      pricingStatus
    };
  }

  buildProviderAssetRef(input: {
    chainId: number;
    tokenAddress: string;
    symbol: string | null;
    providerAssetKey: string | null;
  }): PriceProviderAssetRef {
    return {
      chainId: input.chainId,
      tokenAddress: input.tokenAddress.toLowerCase(),
      symbol: input.symbol,
      providerAssetKey: input.providerAssetKey
    };
  }

  determinePricingMethod(input: { symbol: string | null; providerAssetKey: string | null }): PriceMethod {
    const normalizedSymbol = input.symbol?.toUpperCase() ?? null;
    if (normalizedSymbol && STABLE_SYMBOLS.has(normalizedSymbol)) {
      return "stable_alias";
    }

    if (normalizedSymbol && WRAPPED_ALIASES[normalizedSymbol.toLowerCase()]) {
      return "wrapped_alias";
    }

    return "direct";
  }

  normalizeProviderQuote(input: {
    priceAssetId: string;
    quote: ProviderPriceQuote;
    pricingMethod?: PriceMethod;
  }) {
    return {
      priceAssetId: input.priceAssetId,
      quoteCurrency: "usd" as const,
      sourceKind: input.quote.sourceKind,
      effectiveAt: input.quote.effectiveAt,
      fetchedAt: input.quote.fetchedAt,
      priceValue: input.quote.priceValue,
      resolution: input.quote.resolution,
      confidence: input.quote.confidence,
      pricingMethod: input.pricingMethod ?? input.quote.pricingMethod,
      providerName: input.quote.providerName,
      providerReference: input.quote.providerReference
    };
  }
}