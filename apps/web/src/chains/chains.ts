export const SUPPORTED_CHAIN_ID = 8453;

export type SupportedChainKey = "base";

export type SupportedChain = {
  key: SupportedChainKey;
  chainId: number;
  name: string;
  network: string;
  explorerBaseUrl: string;
  moralisChain: string;
  alchemyNetwork: string;
  rpcUrlEnvVar: string;
};

export const SUPPORTED_CHAINS: Record<SupportedChainKey, SupportedChain> = {
  base: {
    key: "base",
    chainId: SUPPORTED_CHAIN_ID,
    name: "Base",
    network: "base",
    explorerBaseUrl: "https://basescan.org",
    moralisChain: "base",
    alchemyNetwork: "base-mainnet",
    rpcUrlEnvVar: "ALCHEMY_BASE_RPC_URL",
  },
} as const;

export function getSupportedChain(chainId: number): SupportedChain | undefined {
  return Object.values(SUPPORTED_CHAINS).find((chain) => chain.chainId === chainId);
}

export function assertSupportedChain(chainId: number): SupportedChain {
  const chain = getSupportedChain(chainId);
  if (!chain) {
    throw new Error(`UNSUPPORTED_CHAIN:${chainId}`);
  }

  return chain;
}

export function getMoralisChain(chainId: number): string {
  return assertSupportedChain(chainId).moralisChain;
}

export function getAlchemyNetwork(chainId: number): string {
  return assertSupportedChain(chainId).alchemyNetwork;
}

export function getExplorerBaseUrl(chainId: number): string {
  return assertSupportedChain(chainId).explorerBaseUrl;
}
