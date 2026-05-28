import { SUPPORTED_CHAIN_ID } from "@/chains/chains";

const BASE_WETH_ADDRESS = "0x4200000000000000000000000000000000000006";
const BASE_CBBTC_ADDRESS = "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf";
const BASE_USDC_ADDRESS = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const BASE_EURC_ADDRESS = "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42";

export const CAB_TOKEN_LOCAL_FALLBACK_SRC = "/token-fallback.svg";

type CabKnownTokenAsset = {
  symbol: string;
  name: string;
  iconSrc: string;
};

export type CabTokenIconSourceKind =
  | "addressOverride"
  | "knownSymbol"
  | "externalLookup"
  | "localFallback";

export type CabTokenIconSource = {
  kind: CabTokenIconSourceKind;
  src: string;
};

export type CabTokenIconResolutionInput = {
  chainId?: number | null;
  tokenAddress?: string | null;
  symbol?: string | null;
  name?: string | null;
};

export type CabTokenIconResolution = {
  normalizedAddress: string | null;
  normalizedSymbol: string | null;
  sources: CabTokenIconSource[];
  matchedSymbol: string | null;
  matchedName: string | null;
  fallbackLabel: string;
  fallbackKind: "genericBadge";
};

const TRUST_WALLET_CHAIN_SLUGS: Record<number, string> = {
  1: "ethereum",
  10: "optimism",
  8453: "base",
  42161: "arbitrum",
};

const BASE_TOKEN_ADDRESS_OVERRIDES: Record<string, CabKnownTokenAsset> = {
  [BASE_WETH_ADDRESS]: {
    symbol: "WETH",
    name: "Wrapped Ether",
    iconSrc: "https://assets-cdn.trustwallet.com/blockchains/base/assets/0x4200000000000000000000000000000000000006/logo.png",
  },
  [BASE_CBBTC_ADDRESS]: {
    symbol: "cbBTC",
    name: "Coinbase Wrapped BTC",
    iconSrc: "https://assets.coingecko.com/coins/images/40143/standard/cbbtc.webp",
  },
  [BASE_USDC_ADDRESS]: {
    symbol: "USDC",
    name: "USD Coin",
    iconSrc: "https://ethereum-optimism.github.io/data/USDC/logo.png",
  },
  [BASE_EURC_ADDRESS]: {
    symbol: "EURC",
    name: "Euro Coin",
    iconSrc: "https://assets.coingecko.com/coins/images/26045/thumb/euro-coin.png?1655394420",
  },
};

const BASE_TOKEN_SYMBOL_MAP: Record<string, CabKnownTokenAsset> = {
  eth: BASE_TOKEN_ADDRESS_OVERRIDES[BASE_WETH_ADDRESS],
  weth: BASE_TOKEN_ADDRESS_OVERRIDES[BASE_WETH_ADDRESS],
  cbbtc: BASE_TOKEN_ADDRESS_OVERRIDES[BASE_CBBTC_ADDRESS],
  usdc: BASE_TOKEN_ADDRESS_OVERRIDES[BASE_USDC_ADDRESS],
  eurc: BASE_TOKEN_ADDRESS_OVERRIDES[BASE_EURC_ADDRESS],
};

function normalizeAddress(address: string | null | undefined) {
  return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address)
    ? address.toLowerCase()
    : null;
}

function normalizeSymbol(symbol: string | null | undefined) {
  return typeof symbol === "string" && symbol.trim().length > 0
    ? symbol.trim().toLowerCase()
    : null;
}

function shortenAddress(address: string | null) {
  if (!address) {
    return "TOKEN";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function buildFallbackLabel(input: CabTokenIconResolutionInput, normalizedAddress: string | null) {
  if (typeof input.symbol === "string" && input.symbol.trim().length > 0) {
    return input.symbol.trim().toUpperCase();
  }

  return shortenAddress(normalizedAddress).toUpperCase();
}

function buildExternalLibraryLookup(chainId: number | null | undefined, tokenAddress: string | null) {
  if (!chainId || !tokenAddress) {
    return null;
  }

  const chainSlug = TRUST_WALLET_CHAIN_SLUGS[chainId];
  if (!chainSlug) {
    return null;
  }

  return `https://assets-cdn.trustwallet.com/blockchains/${chainSlug}/assets/${tokenAddress}/logo.png`;
}

function dedupeSources(sources: CabTokenIconSource[]) {
  const seen = new Set<string>();

  return sources.filter((source) => {
    if (seen.has(source.src)) {
      return false;
    }

    seen.add(source.src);
    return true;
  });
}

export function resolveCabTokenIcon(input: CabTokenIconResolutionInput): CabTokenIconResolution {
  const normalizedAddress = normalizeAddress(input.tokenAddress);
  const normalizedSymbol = normalizeSymbol(input.symbol);
  const isBaseChain = input.chainId === SUPPORTED_CHAIN_ID;
  const addressOverride = isBaseChain && normalizedAddress
    ? (BASE_TOKEN_ADDRESS_OVERRIDES[normalizedAddress] ?? null)
    : null;
  const symbolMatch = isBaseChain && normalizedSymbol
    ? (BASE_TOKEN_SYMBOL_MAP[normalizedSymbol] ?? null)
    : null;
  const externalLookup = buildExternalLibraryLookup(input.chainId, normalizedAddress);
  const sources = dedupeSources([
    ...(addressOverride ? [{ kind: "addressOverride" as const, src: addressOverride.iconSrc }] : []),
    ...(symbolMatch ? [{ kind: "knownSymbol" as const, src: symbolMatch.iconSrc }] : []),
    ...(externalLookup ? [{ kind: "externalLookup" as const, src: externalLookup }] : []),
    { kind: "localFallback" as const, src: CAB_TOKEN_LOCAL_FALLBACK_SRC },
  ]);

  return {
    normalizedAddress,
    normalizedSymbol,
    sources,
    matchedSymbol: addressOverride?.symbol ?? symbolMatch?.symbol ?? input.symbol ?? null,
    matchedName: addressOverride?.name ?? symbolMatch?.name ?? input.name ?? null,
    fallbackLabel: buildFallbackLabel(input, normalizedAddress),
    fallbackKind: "genericBadge",
  };
}