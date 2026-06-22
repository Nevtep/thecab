export const AUTHENTICATED_ADDRESS_COOKIE = "cab_authenticated_address";

export type WalletAuthMode = "PROD" | "DEBUG";

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export function normalizeWalletAddress(value: string | null | undefined) {
  const candidate = value?.trim().toLowerCase() ?? null;
  return candidate && ADDRESS_PATTERN.test(candidate) ? candidate : null;
}

export function resolveWalletAuthMode(input?: {
  explicitMode?: string | null;
  nodeEnv?: string | null;
}) {
  const normalizedMode = input?.explicitMode?.trim().toUpperCase();
  if (normalizedMode === "PROD" || normalizedMode === "DEBUG") {
    return normalizedMode satisfies WalletAuthMode;
  }

  return input?.nodeEnv === "production" ? "PROD" : "DEBUG";
}

export function resolveDebugWalletAddress(explicitAddress?: string | null) {
  return normalizeWalletAddress(explicitAddress ?? null);
}

export function resolveAuthenticatedWalletAddress(input: {
  cookieWalletAddress?: string | null;
  requestedWalletAddress?: string | null;
  debugWalletAddress?: string | null;
  mode: WalletAuthMode;
}) {
  const cookieWalletAddress = normalizeWalletAddress(input.cookieWalletAddress);
  const requestedWalletAddress = normalizeWalletAddress(input.requestedWalletAddress);
  const debugWalletAddress = normalizeWalletAddress(input.debugWalletAddress);

  if (cookieWalletAddress && requestedWalletAddress && cookieWalletAddress === requestedWalletAddress) {
    return requestedWalletAddress;
  }

  if (cookieWalletAddress && !requestedWalletAddress) {
    return cookieWalletAddress;
  }

  if (input.mode !== "PROD") {
    return requestedWalletAddress ?? debugWalletAddress ?? cookieWalletAddress;
  }

  return null;
}