import { NextRequest, NextResponse } from "next/server";

import {
  analysisSessionResponseSchema,
  createAnalysisSessionRequestSchema,
  errorResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { AnalysisSessionService } from "@/domains/wallet-session/services/analysis-session-service";
import { getDb } from "@/infrastructure/db/client";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

export async function POST(request: NextRequest) {
  try {
    const payload = createAnalysisSessionRequestSchema.parse(await request.json());
    const session = await new AnalysisSessionService(new SessionRepository(getDb())).createOrResume({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      connectionSource: payload.connectionSource
    });

    return NextResponse.json(
      analysisSessionResponseSchema.parse({
        sessionId: session.analysisSessionId,
        walletAddress: session.walletAddress,
        chainId: session.chainId,
        status: session.status,
        latestAcceptedRunId: session.latestAcceptedRunId
      }),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create analysis session.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}