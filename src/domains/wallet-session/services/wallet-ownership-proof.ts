const WALLET_PROOF_PREFIX = "The Cab Wallet Ownership Verification";
const WALLET_PROOF_MAX_AGE_MS = 5 * 60 * 1000;

type WalletOwnershipMessageInput = {
  walletAddress: string;
  chainId: number;
  signedAt: string;
};

export type WalletOwnershipProof = WalletOwnershipMessageInput & {
  message: string;
  signature: string;
};

export function buildWalletOwnershipMessage(input: WalletOwnershipMessageInput) {
  return [
    WALLET_PROOF_PREFIX,
    "",
    `Wallet: ${input.walletAddress.toLowerCase()}`,
    `ChainId: ${input.chainId}`,
    `SignedAt: ${input.signedAt}`,
    "",
    "By signing this message, you confirm ownership of this wallet for read-only portfolio analysis in The Cab."
  ].join("\n");
}

export function validateWalletProofFreshness(signedAt: string, nowMs = Date.now()) {
  const parsed = Date.parse(signedAt);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  const ageMs = nowMs - parsed;
  return ageMs >= 0 && ageMs <= WALLET_PROOF_MAX_AGE_MS;
}
