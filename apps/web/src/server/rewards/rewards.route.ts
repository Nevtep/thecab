import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  REWARDS_COVERAGE_VALUES,
  REWARDS_DATE_PRESET_VALUES,
  REWARDS_PAGE_SIZE_VALUES,
  REWARDS_RESOLUTION_STATUS_VALUES,
  REWARDS_SORT_DIRECTION_VALUES,
  REWARDS_SORT_KEY_VALUES,
  REWARDS_SOURCE_FILTER_VALUES,
} from "@/server/rewards/rewards.contract";
import type { RewardsRequest } from "@/server/rewards/rewards.types";
import { getRewardsDataView } from "@/server/rewards/rewards.service";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

type RewardsRouteDeps = {
  parseRequest: typeof parseRewardsRequest;
  readDataView: typeof getRewardsDataView;
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const nullableUuid = z.string().regex(UUID_PATTERN).nullable().default(null);
const nullableAddress = z.string().regex(ADDRESS_PATTERN).transform((value) => value.toLowerCase()).nullable().default(null);
const nullableDate = z.string().regex(DATE_PATTERN).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))).nullable().default(null);

const rewardsQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  search: z.string().trim().max(96).default(""),
  datePreset: z.enum(REWARDS_DATE_PRESET_VALUES).default("all"),
  dateStart: nullableDate,
  dateEnd: nullableDate,
  source: z.enum(REWARDS_SOURCE_FILTER_VALUES).default("all"),
  tokenAddress: nullableAddress,
  poolId: nullableUuid,
  depositId: nullableUuid,
  strategyExposureId: nullableUuid,
  rewardType: z.string().trim().max(64).nullable().default(null),
  coverage: z.enum(REWARDS_COVERAGE_VALUES).nullable().default(null),
  resolutionStatus: z.enum(REWARDS_RESOLUTION_STATUS_VALUES).nullable().default(null),
  selectedRewardEventId: nullableUuid,
  sort: z.enum(REWARDS_SORT_KEY_VALUES).default("occurredAt"),
  direction: z.enum(REWARDS_SORT_DIRECTION_VALUES).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).default(25),
});

const allowedParams = new Set([
  "chainId",
  "search",
  "datePreset",
  "dateStart",
  "dateEnd",
  "source",
  "tokenAddress",
  "token",
  "poolId",
  "pool",
  "depositId",
  "deposit",
  "strategyExposureId",
  "strategy",
  "rewardType",
  "coverage",
  "resolutionStatus",
  "selectedRewardEventId",
  "selected",
  "sort",
  "direction",
  "page",
  "pageSize",
]);

async function readAuthenticatedWalletAddress() {
  const cookieStore = await cookies();
  const authenticatedAddress = cookieStore.get("cab_authenticated_address")?.value?.toLowerCase() ?? null;

  if (!authenticatedAddress) {
    throw new Error("REWARDS_REQUEST_FAILED:UNAUTHENTICATED_WALLET");
  }

  return authenticatedAddress;
}

export function normalizeRewardsQueryParams(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (!allowedParams.has(key)) {
      throw new Error("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS:UNKNOWN_PARAM");
    }
  }

  const parsed = rewardsQuerySchema.safeParse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    search: searchParams.get("search") ?? undefined,
    datePreset: searchParams.get("datePreset") ?? undefined,
    dateStart: searchParams.get("dateStart") ?? null,
    dateEnd: searchParams.get("dateEnd") ?? null,
    source: searchParams.get("source") ?? undefined,
    tokenAddress: searchParams.get("tokenAddress") ?? searchParams.get("token") ?? null,
    poolId: searchParams.get("poolId") ?? searchParams.get("pool") ?? null,
    depositId: searchParams.get("depositId") ?? searchParams.get("deposit") ?? null,
    strategyExposureId: searchParams.get("strategyExposureId") ?? searchParams.get("strategy") ?? null,
    rewardType: searchParams.get("rewardType") ?? null,
    coverage: searchParams.get("coverage") ?? null,
    resolutionStatus: searchParams.get("resolutionStatus") ?? null,
    selectedRewardEventId: searchParams.get("selectedRewardEventId") ?? searchParams.get("selected") ?? null,
    sort: searchParams.get("sort") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS", { cause: parsed.error });
  }

  assertSupportedChain(parsed.data.chainId);

  if (parsed.data.datePreset === "custom" && (!parsed.data.dateStart || !parsed.data.dateEnd)) {
    throw new Error("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS:CUSTOM_RANGE_REQUIRED");
  }
  if (parsed.data.datePreset === "custom" && parsed.data.dateStart && parsed.data.dateEnd && parsed.data.dateStart > parsed.data.dateEnd) {
    throw new Error("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS:CUSTOM_RANGE_INVALID");
  }

  return parsed.data;
}

export async function parseRewardsRequest(request: Request): Promise<RewardsRequest> {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeRewardsQueryParams(searchParams);

  // Provider-boundary guard: request-time Rewards reads normalized persistence only.
  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: normalized.chainId,
    search: normalized.search,
    datePreset: normalized.datePreset,
    dateStart: normalized.dateStart,
    dateEnd: normalized.dateEnd,
    source: normalized.source,
    tokenAddress: normalized.tokenAddress,
    poolId: normalized.poolId,
    depositId: normalized.depositId,
    strategyExposureId: normalized.strategyExposureId,
    rewardType: normalized.rewardType,
    coverage: normalized.coverage,
    resolutionStatus: normalized.resolutionStatus,
    selectedRewardEventId: normalized.selectedRewardEventId,
    sort: {
      key: normalized.sort,
      direction: normalized.direction,
    },
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export function getRewardsErrorStatus(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  if (error instanceof z.ZodError || cause instanceof z.ZodError) {
    return { code: "INVALID_REWARDS_FILTERS", status: 400, details: error instanceof z.ZodError ? error.issues : cause instanceof z.ZodError ? cause.issues : undefined };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "UNSUPPORTED_CHAIN", status: 400, details: undefined };
  }
  if (message.startsWith("REWARDS_REQUEST_FAILED:UNAUTHENTICATED_WALLET")) {
    return { code: "UNAUTHENTICATED_WALLET", status: 401, details: undefined };
  }
  if (message.startsWith("REWARDS_REQUEST_FAILED:INVALID_REWARDS_FILTERS")) {
    return { code: "INVALID_REWARDS_FILTERS", status: 400, details: undefined };
  }
  if (message.startsWith("REWARDS_REQUEST_FAILED:ANALYSIS_NOT_FOUND")) {
    return { code: "ANALYSIS_NOT_FOUND", status: 200, details: undefined };
  }
  return { code: "REWARDS_READ_FAILED", status: 500, details: undefined };
}

export async function handleRewardsGet(request: Request, deps: RewardsRouteDeps = {
  parseRequest: parseRewardsRequest,
  readDataView: getRewardsDataView,
}) {
  try {
    const input = await deps.parseRequest(request);
    const response = await deps.readDataView(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getRewardsErrorStatus(error);
    return NextResponse.json(
      {
        error: {
          code: failure.code,
          ...(failure.details === undefined ? {} : { details: failure.details }),
        },
      },
      {
        status: failure.status,
        headers: RESPONSE_HEADERS,
      },
    );
  }
}
