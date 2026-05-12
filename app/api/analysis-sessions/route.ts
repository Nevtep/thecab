import { NextRequest, NextResponse } from "next/server";
import { recoverMessageAddress } from "viem";
import { base } from "wagmi/chains";

import {
  analysisSessionResponseSchema,
  createAnalysisSessionRequestSchema,
  errorResponseSchema
} from "@/domains/ledger/contracts/ledger-api-schemas";
import { AnalysisSessionService } from "@/domains/wallet-session/services/analysis-session-service";
import {
  buildWalletOwnershipMessage,
  validateWalletProofFreshness
} from "@/domains/wallet-session/services/wallet-ownership-proof";
import { getDb } from "@/infrastructure/db/client";
import { SessionRepository } from "@/domains/wallet-session/repositories/session-repository";

function shouldBypassWalletProofValidation() {
  return process.env.NODE_ENV === "test";
}

async function verifyWalletOwnershipProof(input: {
  walletAddress: string;
  chainId: number;
  proof:
    | {
        message: string;
        signature: string;
        signedAt: string;
      }
    | undefined;
}) {
  if (shouldBypassWalletProofValidation()) {
    return;
  }

  if (!input.proof) {
    throw new Error("Wallet signature proof is required before creating an analysis session.");
  }

  if (!validateWalletProofFreshness(input.proof.signedAt)) {
    throw new Error("Wallet signature proof expired. Please sign a new message.");
  }

  const expectedMessage = buildWalletOwnershipMessage({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    signedAt: input.proof.signedAt
  });

  if (input.proof.message !== expectedMessage) {
    throw new Error("Wallet signature proof message mismatch.");
  }

  const recoveredAddress = await recoverMessageAddress({
    message: input.proof.message,
    signature: input.proof.signature as `0x${string}`
  });

  if (recoveredAddress.toLowerCase() !== input.walletAddress.toLowerCase()) {
    throw new Error("Wallet signature proof does not match the connected wallet.");
  }
}

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
    await verifyWalletOwnershipProof({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      proof: payload.walletProof
    });

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