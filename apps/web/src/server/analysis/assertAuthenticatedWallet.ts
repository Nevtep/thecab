import { cookies } from "next/headers";

export async function assertAuthenticatedWallet(walletAddress: string) {
  const cookieStore = await cookies();
  const authenticatedAddress = cookieStore.get("cab_authenticated_address")?.value?.toLowerCase() ?? null;

  if (!authenticatedAddress || authenticatedAddress !== walletAddress.toLowerCase()) {
    throw new Error("ANALYSIS_REQUEST_FAILED:UNAUTHORIZED");
  }
}