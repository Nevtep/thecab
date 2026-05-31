import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ACTIVITY_ACTION_VALUES,
  ACTIVITY_CONFIDENCE_VALUES,
  ACTIVITY_COVERAGE_VALUES,
  ACTIVITY_PAGE_SIZE_VALUES,
  ACTIVITY_SORT_DIRECTION_VALUES,
  ACTIVITY_SORT_KEY_VALUES,
  ACTIVITY_SURFACE_VALUES,
} from "@/server/activity/activity.contract";
import type { ActivityRequest } from "@/server/activity/activity.types";
import { getActivityDataView } from "@/server/activity/activity.service";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const nullableUuid = z.string().regex(UUID_PATTERN).nullable().default(null);

const activityQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  search: z.string().trim().max(96).default(""),
  surface: z.enum(ACTIVITY_SURFACE_VALUES).default("all"),
  action: z.union([z.literal("all"), z.enum(ACTIVITY_ACTION_VALUES)]).default("all"),
  coverage: z.enum(ACTIVITY_COVERAGE_VALUES).nullable().default(null),
  confidence: z.enum(ACTIVITY_CONFIDENCE_VALUES).nullable().default(null),
  poolId: nullableUuid,
  depositId: nullableUuid,
  strategyId: nullableUuid,
  rewardEventId: nullableUuid,
  governanceEventId: nullableUuid,
  selectedActivityId: nullableUuid,
  sort: z.enum(ACTIVITY_SORT_KEY_VALUES).default("occurredAt"),
  direction: z.enum(ACTIVITY_SORT_DIRECTION_VALUES).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.union([
    z.literal(ACTIVITY_PAGE_SIZE_VALUES[0]),
    z.literal(ACTIVITY_PAGE_SIZE_VALUES[1]),
    z.literal(ACTIVITY_PAGE_SIZE_VALUES[2]),
    z.literal(ACTIVITY_PAGE_SIZE_VALUES[3]),
  ])).default(10),
});

const allowedParams = new Set([
  "chainId",
  "search",
  "surface",
  "action",
  "coverage",
  "confidence",
  "poolId",
  "depositId",
  "strategyId",
  "rewardEventId",
  "governanceEventId",
  "selectedActivityId",
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
    throw new Error("ACTIVITY_REQUEST_FAILED:UNAUTHENTICATED_WALLET");
  }

  return authenticatedAddress;
}

export function normalizeActivityQueryParams(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (!allowedParams.has(key)) {
      throw new Error("ACTIVITY_REQUEST_FAILED:INVALID_ACTIVITY_FILTERS:UNKNOWN_PARAM");
    }
  }

  const parsed = activityQuerySchema.safeParse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    search: searchParams.get("search") ?? undefined,
    surface: searchParams.get("surface") ?? undefined,
    action: searchParams.get("action") ?? undefined,
    coverage: searchParams.get("coverage") ?? null,
    confidence: searchParams.get("confidence") ?? null,
    poolId: searchParams.get("poolId") ?? null,
    depositId: searchParams.get("depositId") ?? null,
    strategyId: searchParams.get("strategyId") ?? null,
    rewardEventId: searchParams.get("rewardEventId") ?? null,
    governanceEventId: searchParams.get("governanceEventId") ?? null,
    selectedActivityId: searchParams.get("selectedActivityId") ?? searchParams.get("selected") ?? null,
    sort: searchParams.get("sort") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("ACTIVITY_REQUEST_FAILED:INVALID_ACTIVITY_FILTERS", { cause: parsed.error });
  }

  assertSupportedChain(parsed.data.chainId);
  return parsed.data;
}

export async function parseActivityRequest(request: Request): Promise<ActivityRequest> {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeActivityQueryParams(searchParams);

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: normalized.chainId,
    search: normalized.search,
    surface: normalized.surface,
    action: normalized.action,
    coverage: normalized.coverage,
    confidence: normalized.confidence,
    poolId: normalized.poolId,
    depositId: normalized.depositId,
    strategyId: normalized.strategyId,
    rewardEventId: normalized.rewardEventId,
    governanceEventId: normalized.governanceEventId,
    selectedActivityId: normalized.selectedActivityId,
    sort: {
      key: normalized.sort,
      direction: normalized.direction,
    },
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export function getActivityErrorStatus(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  if (error instanceof z.ZodError || cause instanceof z.ZodError) {
    return { code: "INVALID_ACTIVITY_FILTERS", status: 400, details: error instanceof z.ZodError ? error.issues : cause instanceof z.ZodError ? cause.issues : undefined };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "UNSUPPORTED_CHAIN", status: 400, details: undefined };
  }
  if (message.startsWith("ACTIVITY_REQUEST_FAILED:UNAUTHENTICATED_WALLET")) {
    return { code: "UNAUTHENTICATED_WALLET", status: 401, details: undefined };
  }
  if (message.startsWith("ACTIVITY_REQUEST_FAILED:INVALID_ACTIVITY_FILTERS")) {
    return { code: "INVALID_ACTIVITY_FILTERS", status: 400, details: undefined };
  }
  return { code: "ACTIVITY_READ_FAILED", status: 500, details: undefined };
}

export async function handleActivityGet(request: Request, deps: {
  parseRequest: typeof parseActivityRequest;
  readDataView: typeof getActivityDataView;
} = {
  parseRequest: parseActivityRequest,
  readDataView: getActivityDataView,
}) {
  try {
    const input = await deps.parseRequest(request);
    const response = await deps.readDataView(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getActivityErrorStatus(error);
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
