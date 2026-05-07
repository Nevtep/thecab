import { base } from "viem/chains";
import { createPublicClient, fallback, http } from "viem";

import {
  DEFAULT_RPC_REQUESTS_PER_SECOND,
  getRateLimitedFetchFn
} from "@/infrastructure/chain/rpc-rate-limit";
import { logger } from "@/infrastructure/observability/logger";

type RpcClientKind = "public" | "trace";

function extractRpcMethod(init?: RequestInit) {
  if (typeof init?.body !== "string") {
    return null;
  }

  try {
    const parsedBody = JSON.parse(init.body) as { method?: string } | Array<{ method?: string }>;
    if (Array.isArray(parsedBody)) {
      return parsedBody.map((entry) => entry.method).filter(Boolean).join(",") || null;
    }

    return parsedBody.method ?? null;
  } catch {
    return null;
  }
}

function createLoggedRpcFetchFn(input: {
  rpcUrl: string;
  clientKind: RpcClientKind;
  rpcRole: "primary" | "fallback" | "trace";
  rpcIndex: number;
}) {
  const rateLimitedFetchFn = getRateLimitedFetchFn(input.rpcUrl, DEFAULT_RPC_REQUESTS_PER_SECOND);

  return async (request: RequestInfo | URL, init?: RequestInit) => {
    const method = extractRpcMethod(init);
    logger.info("Base RPC request started.", {
      rpcUrl: input.rpcUrl,
      clientKind: input.clientKind,
      rpcRole: input.rpcRole,
      rpcIndex: input.rpcIndex,
      method
    });

    try {
      const response = await rateLimitedFetchFn(request, init);
      logger.info("Base RPC request completed.", {
        rpcUrl: input.rpcUrl,
        clientKind: input.clientKind,
        rpcRole: input.rpcRole,
        rpcIndex: input.rpcIndex,
        method,
        status: response.status
      });
      return response;
    } catch (error) {
      logger.warn("Base RPC request failed.", {
        rpcUrl: input.rpcUrl,
        clientKind: input.clientKind,
        rpcRole: input.rpcRole,
        rpcIndex: input.rpcIndex,
        method,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  };
}

function getBaseRpcUrls(primaryRpcUrl?: string) {
  const configuredFallbacks = (process.env.BASE_RPC_FALLBACK_URLS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set([
    primaryRpcUrl,
    ...configuredFallbacks,
    ...(base.rpcUrls.default.http ?? []),
  ].filter((value): value is string => Boolean(value)))];
}

function createBaseClient(rpcUrls: string[], clientKind: RpcClientKind) {
  return createPublicClient({
    chain: base,
    transport: fallback(
      rpcUrls.map((rpcUrl, index) =>
        http(rpcUrl, {
          timeout: 20_000,
          fetchFn: createLoggedRpcFetchFn({
            rpcUrl,
            clientKind,
            rpcRole: clientKind === "trace" ? "trace" : index === 0 ? "primary" : "fallback",
            rpcIndex: index
          })
        })
      )
    )
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

export function getBasePublicRpcUrls() {
  return getBaseRpcUrls(requireBaseRpcUrl());
}

export function createBasePublicClient(rpcUrls: string[]): PublicClient {
  return createBaseClient(rpcUrls, "public");
}

export function getBasePublicClient(): PublicClient {
  if (!global.__theCabBasePublicClient__) {
    const rpcUrls = getBasePublicRpcUrls();
    logger.info("Initializing Base public client.", {
      primaryRpcUrl: rpcUrls[0] ?? null,
      fallbackRpcUrls: rpcUrls.slice(1)
    });
    global.__theCabBasePublicClient__ = createBasePublicClient(rpcUrls);
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
    logger.info("Initializing Base trace client.", {
      traceRpcUrl
    });
    global.__theCabBaseTraceClient__ = createBaseClient([traceRpcUrl], "trace");
  }

  return global.__theCabBaseTraceClient__ ?? null;
}