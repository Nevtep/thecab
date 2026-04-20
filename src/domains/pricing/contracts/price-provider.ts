import { type PriceConfidence, type PriceMethod, type PriceSourceKind } from "@/domains/pricing/model/price-point";

export type PriceProviderAssetRef = {
  chainId: number;
  tokenAddress: string;
  symbol: string | null;
  providerAssetKey: string | null;
};

export type HistoricalPriceRequest = {
  asset: PriceProviderAssetRef;
  effectiveAt: Date;
};

export type CurrentPriceRequest = {
  asset: PriceProviderAssetRef;
  asOf: Date;
};

export type ProviderPriceQuote = {
  sourceKind: PriceSourceKind;
  effectiveAt: Date;
  fetchedAt: Date;
  priceValue: string;
  resolution: "minute" | "hour" | "spot";
  confidence: PriceConfidence;
  pricingMethod: PriceMethod;
  providerName: string;
  providerReference: string | null;
};

export interface PriceProvider {
  getHistoricalPrice(request: HistoricalPriceRequest): Promise<ProviderPriceQuote | null>;
  getCurrentPrice(request: CurrentPriceRequest): Promise<ProviderPriceQuote | null>;
}