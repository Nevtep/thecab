import { cookies } from "next/headers";

import {
  AUTHENTICATED_ADDRESS_COOKIE,
  resolveAuthenticatedWalletAddress,
  resolveDebugWalletAddress,
  resolveWalletAuthMode,
} from "@/wallet/walletAuth.shared";

function getWalletAuthMode() {
  return resolveWalletAuthMode({
    explicitMode: process.env.CAB_WALLET_AUTH_MODE ?? process.env.NEXT_PUBLIC_CAB_WALLET_AUTH_MODE ?? null,
    nodeEnv: process.env.NODE_ENV ?? "development",
  });
}

function getDebugWalletAddress() {
  return resolveDebugWalletAddress(
    process.env.DEBUG_WALLET_ADDRESS ?? process.env.NEXT_PUBLIC_DEBUG_WALLET_ADDRESS ?? null,
  );
}

export async function readAuthenticatedWalletAddress(input: {
  requestedWalletAddress?: string | null;
  unauthorizedMessage: string;
}) {
  const cookieStore = await cookies();
  const authenticatedAddress = cookieStore.get(AUTHENTICATED_ADDRESS_COOKIE)?.value ?? null;
  const resolvedAddress = resolveAuthenticatedWalletAddress({
    cookieWalletAddress: authenticatedAddress,
    requestedWalletAddress: input.requestedWalletAddress,
    debugWalletAddress: getDebugWalletAddress(),
    mode: getWalletAuthMode(),
  });

  if (!resolvedAddress) {
    throw new Error(input.unauthorizedMessage);
  }

  return resolvedAddress;
}

export async function assertAuthenticatedWallet(
  walletAddress: string,
  unauthorizedMessage = "ANALYSIS_REQUEST_FAILED:UNAUTHORIZED",
) {
  await readAuthenticatedWalletAddress({
    requestedWalletAddress: walletAddress,
    unauthorizedMessage,
  });
}