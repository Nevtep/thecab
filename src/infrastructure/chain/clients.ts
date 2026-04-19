import { base } from "viem/chains";
import { createPublicClient, http } from "viem";

function createBaseClient(rpcUrl: string) {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl)
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
    global.__theCabBasePublicClient__ = createBaseClient(requireBaseRpcUrl());
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
    global.__theCabBaseTraceClient__ = createBaseClient(traceRpcUrl);
  }

  return global.__theCabBaseTraceClient__ ?? null;
}