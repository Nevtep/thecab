export const SUPPORTED_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_SUPPORTED_CHAIN_ID ?? 8453,
);

export const DEFAULT_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID ?? SUPPORTED_CHAIN_ID,
);

export function isSupportedChain(chainId?: number): boolean {
  if (!chainId) return false;
  return chainId === SUPPORTED_CHAIN_ID;
}
