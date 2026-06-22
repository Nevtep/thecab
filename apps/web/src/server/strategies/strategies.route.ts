import { z } from "zod";

import { assertOpaqueEntityId, normalizeOpaqueEntityId } from "@/analysis/opaqueEntityId";
import { readAuthenticatedWalletAddress as readRequestWalletAddress } from "@/server/auth/walletAuth";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import type { StrategiesListRequest, StrategyDetailRequest } from "@/server/strategies/strategies.types";

const strategiesListQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  status: z.enum(["active", "closed", "all"] as const).default("active"),
  protocol: z.enum(["mellow", "all"] as const).default("mellow"),
  poolId: z.string().trim().nullable().default(null),
  coverage: z.enum(["full", "share_level", "partial", "unknown", "all"] as const).default("all"),
  returnSign: z.enum(["positive", "negative", "any"] as const).default("any"),
  search: z.string().trim().max(64).default(""),
  sort: z.enum([
    "current_value_desc",
    "current_value_asc",
    "opened_desc",
    "opened_asc",
    "return_desc",
    "return_asc",
    "coverage_asc",
    "coverage_desc",
  ] as const).default("current_value_desc"),
  selectedStrategyId: z.string().trim().nullable().default(null),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50)])).default(10),
});

const allowedListParams = new Set([
  "chainId",
  "status",
  "protocol",
  "pool",
  "poolId",
  "coverage",
  "returnSign",
  "search",
  "sort",
  "selectedStrategyId",
  "page",
  "pageSize",
]);

export function normalizeStrategiesListQueryParams(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (!allowedListParams.has(key)) {
      throw new Error("STRATEGIES_REQUEST_FAILED:INVALID_REQUEST:UNKNOWN_PARAM");
    }
  }

  const parsed = strategiesListQuerySchema.safeParse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    status: searchParams.get("status") ?? undefined,
    protocol: searchParams.get("protocol") ?? undefined,
    poolId: searchParams.get("pool") ?? searchParams.get("poolId") ?? null,
    coverage: searchParams.get("coverage") ?? undefined,
    returnSign: searchParams.get("returnSign") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    selectedStrategyId: searchParams.get("selectedStrategyId") ?? null,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("STRATEGIES_REQUEST_FAILED:INVALID_REQUEST", { cause: parsed.error });
  }

  assertSupportedChain(parsed.data.chainId);
  return {
    ...parsed.data,
    poolId: normalizeOpaqueEntityId(parsed.data.poolId),
    selectedStrategyId: normalizeOpaqueEntityId(parsed.data.selectedStrategyId),
  };
}

async function readAuthenticatedWalletAddress() {
  return readRequestWalletAddress({ unauthorizedMessage: "STRATEGIES_REQUEST_FAILED:UNAUTHORIZED" });
}

export async function parseStrategiesListRequest(request: Request): Promise<StrategiesListRequest> {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeStrategiesListQueryParams(searchParams);
  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: normalized.chainId,
    status: normalized.status,
    protocol: normalized.protocol,
    poolId: normalized.poolId,
    coverage: normalized.coverage,
    returnSign: normalized.returnSign,
    search: normalized.search,
    sort: normalized.sort,
    selectedStrategyId: normalized.selectedStrategyId,
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export function normalizeStrategyDetailParams(searchParams: URLSearchParams, strategyId: string) {
  const parsed = z.object({
    chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  }).safeParse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
  });

  if (!parsed.success) {
    throw new Error("STRATEGIES_REQUEST_FAILED:INVALID_REQUEST", { cause: parsed.error });
  }

  assertSupportedChain(parsed.data.chainId);
  return {
    chainId: parsed.data.chainId,
    strategyId: assertOpaqueEntityId(strategyId, "STRATEGIES_REQUEST_FAILED:INVALID_REQUEST"),
  };
}

export async function parseStrategyDetailRequest(request: Request, strategyId: string): Promise<StrategyDetailRequest> {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeStrategyDetailParams(searchParams, strategyId);
  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: normalized.chainId,
    strategyId: normalized.strategyId,
  };
}

export function getStrategiesErrorStatus(error: unknown) {
  if (error instanceof z.ZodError) {
    return { code: "invalid_request", status: 400, details: error.issues };
  }

  const cause = error instanceof Error ? error.cause : null;
  if (cause instanceof z.ZodError) {
    return { code: "invalid_request", status: 400, details: cause.issues };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "chain_unsupported", status: 400, details: undefined };
  }
  if (message.startsWith("STRATEGIES_REQUEST_FAILED:INVALID_REQUEST")) {
    return { code: "invalid_request", status: 400, details: undefined };
  }
  if (message.startsWith("STRATEGIES_REQUEST_FAILED:UNAUTHORIZED")) {
    return { code: "wallet_not_authenticated", status: 401, details: undefined };
  }
  if (message.startsWith("STRATEGIES_REQUEST_FAILED:ANALYSIS_NOT_READY")) {
    return { code: "analysis_not_ready", status: 409, details: undefined };
  }
  if (message.startsWith("STRATEGIES_REQUEST_FAILED:STRATEGY_NOT_FOUND")) {
    return { code: "strategy_not_found", status: 404, details: undefined };
  }

  return { code: "internal_error", status: 500, details: undefined };
}
