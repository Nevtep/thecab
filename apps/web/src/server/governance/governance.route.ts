import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  GOVERNANCE_CONFIDENCE_STATES,
  GOVERNANCE_COVERAGE_STATES,
  GOVERNANCE_EVENT_TYPES,
  GOVERNANCE_PAGE_SIZES,
  GOVERNANCE_PROTOCOL_SURFACES,
  GOVERNANCE_REWARD_TYPES,
  GOVERNANCE_SORT_KEYS,
} from "@/server/governance/governance.contract";
import { getGovernanceDataView } from "@/server/governance/governance.service";
import type { GovernanceRequest } from "@/server/governance/governance.types";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;
const SELECTION_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/;
const nullableUuid = z.string().regex(UUID_PATTERN).nullable().default(null);
const nullableAddress = z.string().regex(ADDRESS_PATTERN).transform((value) => value.toLowerCase()).nullable().default(null);
const nullableSelectionId = z.string().trim().regex(SELECTION_PATTERN).nullable().default(null);

const governanceQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  search: z.string().trim().max(96).default(""),
  datePreset: z.enum(["7d", "30d", "90d", "1y", "all", "custom"]).default("all"),
  eventType: z.enum(GOVERNANCE_EVENT_TYPES).default("all"),
  rewardType: z.enum(GOVERNANCE_REWARD_TYPES).default("all"),
  protocolSurface: z.enum(GOVERNANCE_PROTOCOL_SURFACES).default("all"),
  epochId: z.string().trim().max(64).nullable().default(null),
  poolId: nullableUuid,
  tokenAddress: nullableAddress,
  coverage: z.enum(GOVERNANCE_COVERAGE_STATES).nullable().default(null),
  confidence: z.enum(GOVERNANCE_CONFIDENCE_STATES).nullable().default(null),
  selectedKind: z.enum(["event", "reward", "epoch", "metric"]).nullable().default(null),
  selectedGovernanceId: nullableSelectionId,
  sort: z.enum(GOVERNANCE_SORT_KEYS).default("occurredAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().pipe(z.union([
    z.literal(GOVERNANCE_PAGE_SIZES[0]),
    z.literal(GOVERNANCE_PAGE_SIZES[1]),
    z.literal(GOVERNANCE_PAGE_SIZES[2]),
  ])).default(10),
});

const allowedParams = new Set([
  "chainId",
  "search",
  "datePreset",
  "range",
  "eventType",
  "rewardType",
  "protocolSurface",
  "epochId",
  "poolId",
  "tokenAddress",
  "coverage",
  "confidence",
  "selectedKind",
  "selectedGovernanceId",
  "governanceEventId",
  "rewardEventId",
  "kind",
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
    throw new Error("GOVERNANCE_REQUEST_FAILED:UNAUTHENTICATED_WALLET");
  }

  return authenticatedAddress;
}

export function normalizeGovernanceQueryParams(searchParams: URLSearchParams) {
  for (const key of searchParams.keys()) {
    if (!allowedParams.has(key)) {
      throw new Error("GOVERNANCE_REQUEST_FAILED:INVALID_GOVERNANCE_FILTERS:UNKNOWN_PARAM");
    }
  }

  const parsed = governanceQuerySchema.safeParse({
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    search: searchParams.get("search") ?? undefined,
    datePreset: searchParams.get("datePreset") ?? searchParams.get("range") ?? undefined,
    eventType: searchParams.get("eventType") ?? undefined,
    rewardType: searchParams.get("rewardType") ?? undefined,
    protocolSurface: searchParams.get("protocolSurface") ?? undefined,
    epochId: searchParams.get("epochId") ?? null,
    poolId: searchParams.get("poolId") ?? null,
    tokenAddress: searchParams.get("tokenAddress") ?? null,
    coverage: searchParams.get("coverage") ?? null,
    confidence: searchParams.get("confidence") ?? null,
    selectedKind:
      searchParams.get("selectedKind") ??
      searchParams.get("kind") ??
      (searchParams.get("governanceEventId") ? "event" : searchParams.get("rewardEventId") ? "reward" : null),
    selectedGovernanceId:
      searchParams.get("selectedGovernanceId") ??
      searchParams.get("selected") ??
      searchParams.get("governanceEventId") ??
      searchParams.get("rewardEventId") ??
      null,
    sort: searchParams.get("sort") ?? undefined,
    direction: searchParams.get("direction") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });

  if (!parsed.success) {
    throw new Error("GOVERNANCE_REQUEST_FAILED:INVALID_GOVERNANCE_FILTERS", { cause: parsed.error });
  }

  assertSupportedChain(parsed.data.chainId);
  return parsed.data;
}

export async function parseGovernanceRequest(request: Request): Promise<GovernanceRequest> {
  const { searchParams } = new URL(request.url);
  const normalized = normalizeGovernanceQueryParams(searchParams);

  return {
    walletAddress: await readAuthenticatedWalletAddress(),
    chainId: normalized.chainId,
    search: normalized.search,
    datePreset: normalized.datePreset,
    eventType: normalized.eventType,
    rewardType: normalized.rewardType,
    protocolSurface: normalized.protocolSurface,
    epochId: normalized.epochId,
    poolId: normalized.poolId,
    tokenAddress: normalized.tokenAddress,
    coverage: normalized.coverage,
    confidence: normalized.confidence,
    selectedKind: normalized.selectedKind,
    selectedGovernanceId: normalized.selectedGovernanceId,
    sort: {
      key: normalized.sort,
      direction: normalized.direction,
    },
    page: normalized.page,
    pageSize: normalized.pageSize,
  };
}

export function getGovernanceErrorStatus(error: unknown) {
  const cause = error instanceof Error ? error.cause : null;
  if (error instanceof z.ZodError || cause instanceof z.ZodError) {
    return {
      code: "INVALID_GOVERNANCE_FILTERS",
      status: 400,
      details: error instanceof z.ZodError ? error.issues : cause instanceof z.ZodError ? cause.issues : undefined,
    };
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.startsWith("UNSUPPORTED_CHAIN")) {
    return { code: "UNSUPPORTED_CHAIN", status: 400, details: undefined };
  }
  if (message.startsWith("GOVERNANCE_REQUEST_FAILED:UNAUTHENTICATED_WALLET")) {
    return { code: "UNAUTHENTICATED_WALLET", status: 401, details: undefined };
  }
  if (message.startsWith("GOVERNANCE_REQUEST_FAILED:INVALID_GOVERNANCE_FILTERS")) {
    return { code: "INVALID_GOVERNANCE_FILTERS", status: 400, details: undefined };
  }
  return { code: "GOVERNANCE_READ_FAILED", status: 500, details: undefined };
}

export async function handleGovernanceGet(request: Request, deps: {
  parseRequest: typeof parseGovernanceRequest;
  readDataView: typeof getGovernanceDataView;
} = {
  parseRequest: parseGovernanceRequest,
  readDataView: getGovernanceDataView,
}) {
  try {
    const input = await deps.parseRequest(request);
    const response = await deps.readDataView(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getGovernanceErrorStatus(error);
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
