import { cookies } from "next/headers";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import type { PoolDetailRequest, PoolsListRequest } from "@/server/pools/pools.types";

const poolsListQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  status: z.enum(["active", "inactive", "closed", "all"] as const).default("all"),
  exposure: z.enum(["manual", "automated", "mixed", "residual_only", "all"] as const).default("all"),
  coverage: z.enum(["full", "share_level", "partial", "unknown", "all"] as const).default("all"),
  returnBand: z.enum(["positive", "negative", "all"] as const).default("all"),
  search: z.string().trim().max(64).default(""),
  sort: z.enum(["currentValue", "rewards", "return", "recentActivity"] as const).default("currentValue"),
  direction: z.enum(["asc", "desc"] as const).default("desc"),
  cursor: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const poolDetailQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  range: z.enum(["30d", "90d", "180d", "1y", "covered"] as const).default("90d"),
  timelineCursor: z.string().trim().optional(),
  timelineLimit: z.coerce.number().int().min(1).max(100).default(30),
});

async function readAuthenticatedWalletAddress() {
  const cookieStore = await cookies();
  const authenticatedAddress = cookieStore.get("cab_authenticated_address")?.value?.toLowerCase() ?? null;

  if (!authenticatedAddress) {
    throw new Error("POOLS_REQUEST_FAILED:UNAUTHORIZED");
  }

  return authenticatedAddress;
}

export async function parsePoolsListRequest(request: Request): Promise<PoolsListRequest> {
  const { searchParams } = new URL(request.url);
  const parsed = poolsListQuerySchema.parse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    status: searchParams.get("status") ?? undefined,
    exposure: searchParams.get("exposure") ?? undefined,
    coverage: searchParams.get("coverage") ?? undefined,
    returnBand: searchParams.get("returnBand") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  assertSupportedChain(parsed.chainId);

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: parsed.chainId,
    status: parsed.status,
    exposure: parsed.exposure,
    coverage: parsed.coverage,
    returnBand: parsed.returnBand,
    search: parsed.search,
    sort: parsed.sort,
    direction: parsed.direction,
    cursor: parsed.cursor ?? null,
    limit: parsed.limit,
  };
}

export async function parsePoolDetailRequest(request: Request, poolId: string): Promise<PoolDetailRequest> {
  const { searchParams } = new URL(request.url);
  const parsed = poolDetailQuerySchema.parse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    range: searchParams.get("range") ?? undefined,
    timelineCursor: searchParams.get("timelineCursor") ?? undefined,
    timelineLimit: searchParams.get("timelineLimit") ?? undefined,
  });

  assertSupportedChain(parsed.chainId);

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: parsed.chainId,
    poolId,
    range: parsed.range,
    timelineCursor: parsed.timelineCursor ?? null,
    timelineLimit: parsed.timelineLimit,
  };
}

export function getPoolsErrorStatus(error: unknown) {
  if (error instanceof z.ZodError) {
    return {
      code: "invalid_payload",
      status: 400,
      details: error.issues,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "unsupported_chain", status: 400, details: undefined };
  }

  if (message.startsWith("POOLS_REQUEST_FAILED:UNAUTHORIZED")) {
    return { code: "unauthorized", status: 401, details: undefined };
  }

  if (message.startsWith("POOLS_REQUEST_FAILED:ANALYSIS_REQUIRED")) {
    return { code: "analysis_required", status: 423, details: undefined };
  }

  if (message.startsWith("POOLS_REQUEST_FAILED:POOL_NOT_FOUND")) {
    return { code: "pool_not_found", status: 404, details: undefined };
  }

  return { code: "internal_error", status: 500, details: undefined };
}