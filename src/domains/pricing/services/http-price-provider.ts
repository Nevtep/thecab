import { type CurrentPriceRequest, type HistoricalPriceRequest, type PriceProvider, type ProviderPriceQuote } from "@/domains/pricing/contracts/price-provider";

const STATIC_PRICE_BY_ASSET_KEY: Record<string, { historical: string; current: string }> = {
  "usd-coin": { historical: "1", current: "1" },
  eth: { historical: "2000", current: "2100" },
  "0xusdc": { historical: "1", current: "1" },
  "0xweth": { historical: "2000", current: "2100" }
};

function buildStaticQuote(input: {
  price: string;
  sourceKind: "historical" | "current";
  effectiveAt: Date;
  fetchedAt: Date;
  pricingMethod: "direct" | "wrapped_alias" | "stable_alias";
}): ProviderPriceQuote {
  return {
    sourceKind: input.sourceKind,
    effectiveAt: input.effectiveAt,
    fetchedAt: input.fetchedAt,
    priceValue: input.price,
    resolution: input.sourceKind === "historical" ? "hour" : "spot",
    confidence: "high",
    pricingMethod: input.pricingMethod,
    providerName: "static-fixture-provider",
    providerReference: "fixture"
  };
}

export class HttpPriceProvider implements PriceProvider {
  async getHistoricalPrice(request: HistoricalPriceRequest) {
    const staticQuote = this.getStaticPrice(request.asset.providerAssetKey, request.asset.tokenAddress);
    if (staticQuote) {
      return buildStaticQuote({
        price: staticQuote.historical,
        sourceKind: "historical",
        effectiveAt: request.effectiveAt,
        fetchedAt: request.effectiveAt,
        pricingMethod: staticQuote.pricingMethod
      });
    }

    return null;
  }

  async getCurrentPrice(request: CurrentPriceRequest) {
    const staticQuote = this.getStaticPrice(request.asset.providerAssetKey, request.asset.tokenAddress);
    if (staticQuote) {
      return buildStaticQuote({
        price: staticQuote.current,
        sourceKind: "current",
        effectiveAt: request.asOf,
        fetchedAt: request.asOf,
        pricingMethod: staticQuote.pricingMethod
      });
    }

    const providerAssetKey = request.asset.providerAssetKey;
    const baseUrl = process.env.PRICE_PROVIDER_BASE_URL;
    if (!providerAssetKey || !baseUrl) {
      return null;
    }

    const url = new URL("simple/price", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    url.searchParams.set("ids", providerAssetKey);
    url.searchParams.set("vs_currencies", "usd");

    const headers: HeadersInit = {};
    if (process.env.PRICE_PROVIDER_API_KEY) {
      headers["x-cg-pro-api-key"] = process.env.PRICE_PROVIDER_API_KEY;
    }

    const response = await fetch(url, { headers, cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const usd = payload[providerAssetKey]?.usd;
    if (typeof usd !== "number") {
      return null;
    }

    return {
      sourceKind: "current" as const,
      effectiveAt: request.asOf,
      fetchedAt: request.asOf,
      priceValue: usd.toString(),
      resolution: "spot" as const,
      confidence: "medium" as const,
      pricingMethod: "direct" as const,
      providerName: "coingecko",
      providerReference: providerAssetKey
    };
  }

  private getStaticPrice(providerAssetKey: string | null, tokenAddress: string) {
    const lookupKey = providerAssetKey ?? tokenAddress.toLowerCase();
    const found = STATIC_PRICE_BY_ASSET_KEY[lookupKey] ?? STATIC_PRICE_BY_ASSET_KEY[tokenAddress.toLowerCase()];
    if (!found) {
      return null;
    }

    return {
      ...found,
      pricingMethod: lookupKey === "eth" ? "wrapped_alias" : lookupKey === "usd-coin" ? "stable_alias" : "direct"
    } as const;
  }
}