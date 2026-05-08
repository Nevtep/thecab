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

    const baseUrl = process.env.PRICE_PROVIDER_BASE_URL?.trim();
    const apiKey = process.env.PRICE_PROVIDER_API_KEY?.trim() || process.env.ALCHEMY_API_KEY?.trim();
    if (!baseUrl || !apiKey) {
      return null;
    }

    const providerAssetKey = request.asset.providerAssetKey;
    const symbol = this.resolvePricingSymbol(providerAssetKey, request.asset.symbol);
    const endpoint = symbol ? "tokens/by-symbol" : "tokens/by-address";

    const url = this.buildAlchemyPriceUrl({
      baseUrl,
      apiKey,
      endpoint
    });

    if (symbol) {
      url.searchParams.set("symbols", symbol);
    } else {
      url.searchParams.set("addresses", request.asset.tokenAddress.toLowerCase());
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    const usd = this.extractUsdPrice(payload);
    if (!usd) {
      return null;
    }

    return {
      sourceKind: "current" as const,
      effectiveAt: request.asOf,
      fetchedAt: request.asOf,
      priceValue: usd,
      resolution: "spot" as const,
      confidence: "medium" as const,
      pricingMethod: "direct" as const,
      providerName: "alchemy",
      providerReference: symbol ?? request.asset.tokenAddress.toLowerCase()
    };
  }

  private buildAlchemyPriceUrl(input: { baseUrl: string; apiKey: string; endpoint: string }) {
    const normalizedBaseUrl = input.baseUrl.replace(/\/+$/, "");
    const includesApiKey = /\/v1\/[^/]+$/.test(normalizedBaseUrl);
    const root = includesApiKey ? normalizedBaseUrl : `${normalizedBaseUrl}/${encodeURIComponent(input.apiKey)}`;
    return new URL(`${root}/${input.endpoint}`);
  }

  private resolvePricingSymbol(providerAssetKey: string | null, symbol: string | null) {
    const normalizedKey = providerAssetKey?.trim().toLowerCase();
    if (!normalizedKey && symbol) {
      return symbol.trim().toUpperCase();
    }

    if (normalizedKey === "eth") {
      return "ETH";
    }

    if (normalizedKey === "usd-coin") {
      return "USDC";
    }

    if (normalizedKey?.startsWith("0x")) {
      return null;
    }

    return normalizedKey ? normalizedKey.toUpperCase() : null;
  }

  private extractUsdPrice(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const data = (payload as { data?: unknown }).data;
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    for (const entry of data) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const price = (entry as { price?: unknown }).price;
      if (typeof price === "number" && Number.isFinite(price)) {
        return price.toString();
      }

      if (typeof price === "string" && price.trim().length > 0) {
        return price;
      }

      const prices = (entry as { prices?: unknown }).prices;
      if (!Array.isArray(prices)) {
        continue;
      }

      for (const pricedItem of prices) {
        if (!pricedItem || typeof pricedItem !== "object") {
          continue;
        }

        const currency = (pricedItem as { currency?: unknown }).currency;
        if (typeof currency === "string" && currency.toLowerCase() !== "usd") {
          continue;
        }

        const value = (pricedItem as { value?: unknown }).value;
        if (typeof value === "number" && Number.isFinite(value)) {
          return value.toString();
        }

        if (typeof value === "string" && value.trim().length > 0) {
          return value;
        }
      }
    }

    return null;
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