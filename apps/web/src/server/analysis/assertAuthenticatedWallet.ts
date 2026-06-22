import { assertAuthenticatedWallet as assertWalletAuth } from "@/server/auth/walletAuth";

export async function assertAuthenticatedWallet(walletAddress: string) {
  await assertWalletAuth(walletAddress, "ANALYSIS_REQUEST_FAILED:UNAUTHORIZED");
}