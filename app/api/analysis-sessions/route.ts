import { NextRequest, NextResponse } from "next/server";
import { base } from "wagmi/chains";

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
    const requestBody = await request.json();
    if (typeof requestBody?.chainId === "number" && requestBody.chainId !== base.id) {
      return NextResponse.json(
        errorResponseSchema.parse({
          error: "Connected wallet analysis is only available on Base."
        }),
        { status: 400 }
      );
    }

    const payload = createAnalysisSessionRequestSchema.parse(requestBody);
    const session = await new AnalysisSessionService(
      new SessionRepository(getDb())
    ).createOrResumeConnectedWalletSession({
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
        reusedSession: session.reusedSession,
        latestAcceptedRunId: session.latestAcceptedRunId
      }),
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create analysis session.";
    return NextResponse.json(errorResponseSchema.parse({ error: message }), { status: 400 });
  }
}