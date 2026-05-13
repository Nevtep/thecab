import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";

const overviewQuerySchema = z.object({
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = overviewQuerySchema.parse({
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    });

    assertSupportedChain(payload.chainId);

    return NextResponse.json({
      chainId: payload.chainId,
      status: "recent_view",
      metrics: {
        netPortfolioValueUsd: 0,
        deployedValueUsd: 0,
        idleValueUsd: 0,
      },
      coverage: {
        status: "partial",
        reason: "PHASE0_SCaffold",
      },
    });
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
    const code = message.startsWith("UNSUPPORTED_CHAIN") ? "UNSUPPORTED_CHAIN" : "OVERVIEW_FAILED";

    return NextResponse.json(
      {
        code,
        message,
      },
      { status: 500 },
    );
  }
}
