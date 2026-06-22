import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveRequestLocale } from "@/i18n/resolveRequestLocale";
import { assertAuthenticatedWallet } from "@/server/auth/walletAuth";
import { assertSupportedChain, SUPPORTED_CHAIN_ID } from "@/server/chains";
import { OVERVIEW_RANGES } from "@/server/overview/overview.types";
import { getSettings, updateSettings } from "@/server/settings/settings.service";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

const settingsQuerySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.coerce.number().int().positive().default(SUPPORTED_CHAIN_ID),
});

const settingsUpdateSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).transform((value) => value.toLowerCase()),
  chainId: z.number().int().positive().default(SUPPORTED_CHAIN_ID),
  preferences: z.object({
    languagePreference: z.enum(["en", "es"] as const).optional(),
    defaultOverviewRange: z.enum(OVERVIEW_RANGES).optional(),
  }).strict(),
}).strict();

function getSettingsErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        code: "VALIDATION_FAILED",
        details: error.issues,
      },
      {
        status: 400,
        headers: RESPONSE_HEADERS,
      },
    );
  }

  const message = error instanceof Error ? error.message : "Unknown error";
  const isUnsupportedChain = message.startsWith("UNSUPPORTED_CHAIN");
  const isUnauthorized = message.startsWith("SETTINGS_REQUEST_FAILED:UNAUTHORIZED");

  return NextResponse.json(
    {
      code: isUnsupportedChain ? "UNSUPPORTED_CHAIN" : "SETTINGS_REQUEST_FAILED",
    },
    {
      status: isUnsupportedChain ? 409 : isUnauthorized ? 401 : 500,
      headers: RESPONSE_HEADERS,
    },
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const payload = settingsQuerySchema.parse({
      walletAddress: searchParams.get("walletAddress"),
      chainId: searchParams.get("chainId") ?? SUPPORTED_CHAIN_ID,
    });

    assertSupportedChain(payload.chainId);
    await assertAuthenticatedWallet(payload.walletAddress, "SETTINGS_REQUEST_FAILED:UNAUTHORIZED");

    const response = await getSettings({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      requestLocale: await resolveRequestLocale(),
    });

    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = settingsUpdateSchema.parse(await request.json());

    assertSupportedChain(payload.chainId);
    await assertAuthenticatedWallet(payload.walletAddress, "SETTINGS_REQUEST_FAILED:UNAUTHORIZED");

    const response = await updateSettings({
      walletAddress: payload.walletAddress,
      chainId: payload.chainId,
      preferences: payload.preferences,
      requestLocale: await resolveRequestLocale(),
    });

    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    return getSettingsErrorResponse(error);
  }
}