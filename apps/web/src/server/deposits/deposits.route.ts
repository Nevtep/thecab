import { cookies } from "next/headers";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import type {
  DepositDetailRequest,
  DepositsListRequest,
} from "@/server/deposits/deposits.types";

const MAX_DATE_RANGE_DAYS = 365;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const dayString = z.string().regex(DAY_PATTERN, "INVALID_DAY_FORMAT");

const depositsListQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  status: z.enum(["all", "open_active", "open_out_of_range", "closed"] as const).default("all"),
  poolId: z.string().trim().uuid().optional(),
  startDayUtc: dayString.optional(),
  endDayUtc: dayString.optional(),
  returnSign: z.enum(["all", "positive", "negative"] as const).default("all"),
  sort: z.enum(["openedAt", "currentValue", "totalReturn", "totalRewards", "estApr"] as const).default("openedAt"),
  direction: z.enum(["asc", "desc"] as const).default("desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

async function readAuthenticatedWalletAddress() {
  const cookieStore = await cookies();
  const authenticatedAddress = cookieStore.get("cab_authenticated_address")?.value?.toLowerCase() ?? null;
  if (!authenticatedAddress) {
    throw new Error("DEPOSITS_REQUEST_FAILED:UNAUTHORIZED");
  }
  return authenticatedAddress;
}

function clampDateRange(start: string | null, end: string | null) {
  if (!start || !end) return;
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error("DEPOSITS_REQUEST_FAILED:INVALID_PAYLOAD");
  }
  if (endMs < startMs) {
    throw new Error("DEPOSITS_REQUEST_FAILED:INVALID_PAYLOAD");
  }
  const diffDays = Math.floor((endMs - startMs) / 86_400_000);
  if (diffDays > MAX_DATE_RANGE_DAYS) {
    throw new Error("DEPOSITS_REQUEST_FAILED:INVALID_PAYLOAD");
  }
}

export async function parseDepositsListRequest(request: Request): Promise<DepositsListRequest> {
  const { searchParams } = new URL(request.url);
  const parsed = depositsListQuerySchema.parse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    status: searchParams.get("status") ?? undefined,
    poolId: searchParams.get("poolId") ?? undefined,
    startDayUtc: searchParams.get("startDayUtc") ?? undefined,
    endDayUtc: searchParams.get("endDayUtc") ?? undefined,
    returnSign: searchParams.get("returnSign") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  assertSupportedChain(parsed.chainId);
  clampDateRange(parsed.startDayUtc ?? null, parsed.endDayUtc ?? null);

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: parsed.chainId,
    status: parsed.status,
    poolId: parsed.poolId ?? null,
    startDayUtc: parsed.startDayUtc ?? null,
    endDayUtc: parsed.endDayUtc ?? null,
    returnSign: parsed.returnSign,
    sort: parsed.sort,
    direction: parsed.direction,
    page: parsed.page,
    pageSize: parsed.pageSize,
  };
}

const depositDetailQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
});

export async function parseDepositDetailRequest(request: Request, depositId: string): Promise<DepositDetailRequest> {
  const { searchParams } = new URL(request.url);
  const parsed = depositDetailQuerySchema.parse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
  });

  assertSupportedChain(parsed.chainId);
  if (!z.string().uuid().safeParse(depositId).success) {
    throw new Error("DEPOSITS_REQUEST_FAILED:INVALID_PAYLOAD");
  }

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: parsed.chainId,
    depositId,
  };
}

export function getDepositsErrorStatus(error: unknown) {
  if (error instanceof z.ZodError) {
    return { code: "invalid_payload" as const, status: 400, details: error.issues };
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "unsupported_chain" as const, status: 400, details: undefined };
  }
  if (message.startsWith("DEPOSITS_REQUEST_FAILED:UNAUTHORIZED")) {
    return { code: "unauthorized" as const, status: 401, details: undefined };
  }
  if (message.startsWith("DEPOSITS_REQUEST_FAILED:ANALYSIS_REQUIRED")) {
    return { code: "analysis_required" as const, status: 423, details: undefined };
  }
  if (message.startsWith("DEPOSITS_REQUEST_FAILED:DEPOSIT_NOT_FOUND")) {
    return { code: "deposit_not_found" as const, status: 404, details: undefined };
  }
  if (message.startsWith("DEPOSITS_REQUEST_FAILED:INVALID_PAYLOAD")) {
    return { code: "invalid_payload" as const, status: 400, details: undefined };
  }
  if (message.startsWith("DEPOSITS_REQUEST_FAILED:RECONCILIATION_DRIFT")) {
    return { code: "internal_error" as const, status: 500, details: undefined };
  }
  return { code: "internal_error" as const, status: 500, details: undefined };
}
