import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  DEFAULT_OVERVIEW_RANGE,
  normalizeOverviewRange,
} from "@/server/overview/getRecentOverview";
import { OVERVIEW_RANGES, type OverviewRequest, type OverviewResponse } from "@/server/overview/overview.types";

export const overviewQuerySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .transform((value) => value.toLowerCase()),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  range: z.enum(OVERVIEW_RANGES).catch(DEFAULT_OVERVIEW_RANGE),
});

const FORBIDDEN_RESPONSE_KEYS = new Set([
  "possible_spam",
  "verified_contract",
  "requestJson",
  "responseJson",
  "payloadJson",
  "providerScore",
  "rawProvider",
]);

export function parseOverviewRequest(request: Request): OverviewRequest {
  const { searchParams } = new URL(request.url);
  const payload = overviewQuerySchema.parse({
    walletAddress: searchParams.get("walletAddress"),
    chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    range: normalizeOverviewRange(searchParams.get("range")),
  });

  assertSupportedChain(payload.chainId);

  return payload;
}

export function sanitizeOverviewResponse(overview: OverviewResponse): OverviewResponse {
  return {
    ...overview,
    coverage: {
      ...overview.coverage,
      reasonCodes: [...overview.coverage.reasonCodes],
    },
    summary: {
      ...overview.summary,
      coverageReasonCodes: overview.summary.coverageReasonCodes
        ? [...overview.summary.coverageReasonCodes]
        : null,
    },
    metrics: {
      ...overview.metrics,
      coverageReasonCodes: overview.metrics.coverageReasonCodes
        ? [...overview.metrics.coverageReasonCodes]
        : null,
      exclusions: overview.metrics.exclusions
        ? {
            ...overview.metrics.exclusions,
            reasonCodes: [...overview.metrics.exclusions.reasonCodes],
          }
        : null,
    },
    chart: {
      ...overview.chart,
      coverageReasonCodes: overview.chart.coverageReasonCodes
        ? [...overview.chart.coverageReasonCodes]
        : null,
      events: overview.chart.events.map((event) => ({ ...event })),
      points: overview.chart.points.map((point) => ({ ...point })),
    },
    distribution: {
      ...overview.distribution,
      coverageReasonCodes: overview.distribution.coverageReasonCodes
        ? [...overview.distribution.coverageReasonCodes]
        : null,
      slices: overview.distribution.slices.map((slice) => ({ ...slice })),
      exclusions: overview.distribution.exclusions
        ? {
            ...overview.distribution.exclusions,
            reasonCodes: [...overview.distribution.exclusions.reasonCodes],
          }
        : null,
    },
    assets: {
      ...overview.assets,
      coverageReasonCodes: overview.assets.coverageReasonCodes
        ? [...overview.assets.coverageReasonCodes]
        : null,
      rows: overview.assets.rows.map((row) => ({
        tokenAddress: row.tokenAddress,
        chainId: row.chainId,
        symbol: row.symbol,
        name: row.name,
        balance: row.balance,
        priceUsd: row.priceUsd,
        valueUsd: row.valueUsd,
        movement24hPct: row.movement24hPct,
        movement7dPct: row.movement7dPct,
        classification: row.classification,
        priceConfidence: row.priceConfidence,
        trustStatus: row.trustStatus,
        trustReasonCodes: [...row.trustReasonCodes],
        isHiddenByDefault: row.isHiddenByDefault,
        classifierVersion: row.classifierVersion,
      })),
      hiddenSummary: overview.assets.hiddenSummary
        ? {
            ...overview.assets.hiddenSummary,
            reasonCodes: [...overview.assets.hiddenSummary.reasonCodes],
          }
        : null,
    },
    protocolPositions: {
      ...overview.protocolPositions,
      coverageReasonCodes: overview.protocolPositions.coverageReasonCodes
        ? [...overview.protocolPositions.coverageReasonCodes]
        : null,
      rows: overview.protocolPositions.rows.map((row) => ({
        ...row,
        coverageReasonCodes: [...row.coverageReasonCodes],
        metadata: { ...row.metadata },
      })),
      summary: {
        ...overview.protocolPositions.summary,
        familyCounts: { ...overview.protocolPositions.summary.familyCounts },
      },
    },
    activity: {
      ...overview.activity,
      coverageReasonCodes: overview.activity.coverageReasonCodes
        ? [...overview.activity.coverageReasonCodes]
        : null,
      items: overview.activity.items.map((item) => ({ ...item })),
    },
  };
}

function assertNoForbiddenResponseKeys(value: unknown): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoForbiddenResponseKeys(item);
    }

    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_RESPONSE_KEYS.has(key)) {
      throw new Error("OVERVIEW_FAILED");
    }

    assertNoForbiddenResponseKeys(nestedValue);
  }
}

export function assertNoProviderLeakage(overview: OverviewResponse) {
  assertNoForbiddenResponseKeys(overview);

  return overview;
}

export function getOverviewErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        code: "VALIDATION_FAILED",
        details: error.issues,
      },
      { status: 400 },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const code = message.startsWith("UNSUPPORTED_CHAIN")
    ? "UNSUPPORTED_CHAIN"
    : message.startsWith("PROVIDER_REQUEST_FAILED")
      ? "PROVIDER_REQUEST_FAILED"
      : "OVERVIEW_FAILED";

  return NextResponse.json(
    {
      code,
    },
    {
      status:
        code === "UNSUPPORTED_CHAIN"
          ? 400
          : code === "PROVIDER_REQUEST_FAILED"
            ? 502
            : 500,
    },
  );
}