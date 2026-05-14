import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import {
  DEFAULT_OVERVIEW_RANGE,
  getRecentOverview,
  normalizeOverviewRange,
} from "@/server/overview/getRecentOverview";
import { OVERVIEW_RANGES } from "@/server/overview/overview.types";

const overviewQuerySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .transform((value) => value.toLowerCase()),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
  range: z.enum(OVERVIEW_RANGES).catch(DEFAULT_OVERVIEW_RANGE),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = overviewQuerySchema.parse({
      walletAddress: searchParams.get("walletAddress"),
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
      range: normalizeOverviewRange(searchParams.get("range")),
    });

    assertSupportedChain(payload.chainId);

    const overview = await getRecentOverview(payload);

    return NextResponse.json(overview);
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
}
