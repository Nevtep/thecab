export const PRICE_SOURCE_KINDS = ["historical", "current"] as const;
export const PRICE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export const PRICE_METHODS = ["direct", "wrapped_alias", "stable_alias"] as const;
export const PRICE_STATUSES = ["direct", "alias", "unsupported"] as const;

export type PriceSourceKind = (typeof PRICE_SOURCE_KINDS)[number];
export type PriceConfidence = (typeof PRICE_CONFIDENCE_LEVELS)[number];
export type PriceMethod = (typeof PRICE_METHODS)[number];
export type PriceStatus = (typeof PRICE_STATUSES)[number];

export type PriceAsset = {
  priceAssetId: string;
  chainId: number;
  tokenAddress: string;
  symbol: string | null;
  decimals: number | null;
  providerAssetKey: string | null;
  aliasTargetAssetId: string | null;
  pricingStatus: PriceStatus;
};

export type PricePoint = {
  pricePointId: string;
  priceAssetId: string;
  quoteCurrency: "usd";
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

export type PriceCoverageStatus = "priced" | "partial" | "unpriced" | "excluded";

export type PriceCoverageDecision = {
  subjectType: "asset_movement" | "holding_balance" | "scope_summary";
  subjectId: string;
  coverageStatus: PriceCoverageStatus;
  reasonCode: string;
  reasonMessage: string;
  pricePointId: string | null;
  fallbackUsed: boolean;
};