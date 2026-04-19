import { base } from "viem/chains";
import { createPublicClient, fallback, http } from "viem";

function getBaseRpcUrls(primaryRpcUrl?: string) {
  const configuredFallbacks = (process.env.BASE_RPC_FALLBACK_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([
    primaryRpcUrl,
    ...configuredFallbacks,
    ...(base.rpcUrls.default.http ?? []),
    "https://mainnet.base.org",
    "https://base-rpc.publicnode.com",
    "https://base.llamarpc.com"
  ].filter((value): value is string => Boolean(value)))];
}

function createBaseClient(rpcUrls: string[]) {
  return createPublicClient({
    chain: base,
    transport: fallback(rpcUrls.map((rpcUrl) => http(rpcUrl, { timeout: 20_000 })))
  });
}

type PublicClient = ReturnType<typeof createBaseClient>;

declare global {
  var __theCabBasePublicClient__: PublicClient | undefined;
  var __theCabBaseTraceClient__: PublicClient | undefined;
}

function requireBaseRpcUrl(): string {
  const rpcUrl = process.env.BASE_RPC_URL;
  if (!rpcUrl) {
    throw new Error("BASE_RPC_URL is required for Base chain access.");
  }

  return rpcUrl;
}

export function getBasePublicClient(): PublicClient {
  if (!global.__theCabBasePublicClient__) {
    global.__theCabBasePublicClient__ = createBaseClient(getBaseRpcUrls(requireBaseRpcUrl()));
  }

  const client = global.__theCabBasePublicClient__;
  if (!client) {
    throw new Error("Base public client is not initialized.");
  }

  return client;
}

export function getBaseTraceClient(): PublicClient | null {
  const traceRpcUrl = process.env.BASE_TRACE_RPC_URL;
  if (!traceRpcUrl) {
    return null;
  }

  if (!global.__theCabBaseTraceClient__) {
    global.__theCabBaseTraceClient__ = createBaseClient([traceRpcUrl]);
  }

  return global.__theCabBaseTraceClient__ ?? null;
}