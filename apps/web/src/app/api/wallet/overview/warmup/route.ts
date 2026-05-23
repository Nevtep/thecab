import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import { getRecentOverviewChart, normalizeOverviewRange } from "@/server/overview/getRecentOverview";
import { OVERVIEW_RANGES } from "@/server/overview/overview.types";

const warmOverviewSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
  range: z.enum(OVERVIEW_RANGES).catch("30d"),
});

const activeWarmups = new Set<string>();

export async function POST(request: Request) {
  try {
    const payload = warmOverviewSchema.parse(await request.json());
    assertSupportedChain(payload.chainId);

    const normalizedRange = normalizeOverviewRange(payload.range);
    const warmupKey = `${payload.walletAddress}:${payload.chainId}:${normalizedRange}`;

    if (activeWarmups.has(warmupKey)) {
      return NextResponse.json(
        {
          status: "already_running",
          walletAddress: payload.walletAddress,
          chainId: payload.chainId,
          range: normalizedRange,
        },
        { status: 202 },
      );
    }

    activeWarmups.add(warmupKey);

    void getRecentOverviewChart({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      range: normalizedRange,
    }).finally(() => {
      activeWarmups.delete(warmupKey);
    });

    return NextResponse.json(
      {
        status: "queued",
        walletAddress: payload.walletAddress,
        chainId: payload.chainId,
        range: normalizedRange,
      },
      { status: 202 },
    );
  } catch (error) {
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
    const code = message.startsWith("UNSUPPORTED_CHAIN") ? "UNSUPPORTED_CHAIN" : "OVERVIEW_WARMUP_FAILED";

    return NextResponse.json(
      {
        code,
      },
      { status: code === "UNSUPPORTED_CHAIN" ? 400 : 500 },
    );
  }
}