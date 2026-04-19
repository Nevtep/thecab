import { isAddressEqual } from "viem";

import { type FixturePoolDescriptor } from "@/lib/fixture-loader";

export type ObservedWalletTransfer = {
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
};

export type KnownMellowPosition = {
  shareBalanceRaw: string | null;
  wrapperAddress?: string;
  stakingRewardsAddress?: string | null;
  pool?: FixturePoolDescriptor | null;
};

export type InferredMellowStrategy = {
  wrapperAddress: string;
  stakingRewardsAddress: string | null;
  sourceContractAddress: string;
  pool: FixturePoolDescriptor | null;
};

function normalizeAddress(address: string | null | undefined) {
  return address?.toLowerCase() ?? null;
}

function isWalletInbound(transfer: ObservedWalletTransfer, walletAddress: string) {
  return isAddressEqual(transfer.to as `0x${string}`, walletAddress as `0x${string}`);
}

function isWalletOutbound(transfer: ObservedWalletTransfer, walletAddress: string) {
  return isAddressEqual(transfer.from as `0x${string}`, walletAddress as `0x${string}`);
}

function getNetTransferDelta(input: {
  walletAddress: string;
  tokenAddress: string;
  transfers: ObservedWalletTransfer[];
}) {
  return input.transfers.reduce((sum, transfer) => {
    if (!isAddressEqual(transfer.tokenAddress as `0x${string}`, input.tokenAddress as `0x${string}`)) {
      return sum;
    }

    if (isWalletInbound(transfer, input.walletAddress)) {
      return sum + transfer.value;
    }

    if (isWalletOutbound(transfer, input.walletAddress)) {
      return sum - transfer.value;
    }

    return sum;
  }, 0n);
}

export function findKnownMellowStrategy(input: {
  candidateAddresses: Array<string | null | undefined>;
  positions: Iterable<KnownMellowPosition>;
}) {
  const normalizedCandidates = new Set(
    input.candidateAddresses
      .map((address) => normalizeAddress(address))
      .filter((address): address is string => address != null)
  );

  for (const position of input.positions) {
    const wrapperAddress = normalizeAddress(position.wrapperAddress);
    if (wrapperAddress && normalizedCandidates.has(wrapperAddress)) {
      return {
        wrapperAddress,
        stakingRewardsAddress: normalizeAddress(position.stakingRewardsAddress),
        sourceContractAddress: wrapperAddress,
        pool: position.pool ?? null
      } satisfies InferredMellowStrategy;
    }

    const stakingRewardsAddress = normalizeAddress(position.stakingRewardsAddress);
    if (stakingRewardsAddress && normalizedCandidates.has(stakingRewardsAddress) && wrapperAddress) {
      return {
        wrapperAddress,
        stakingRewardsAddress,
        sourceContractAddress: wrapperAddress,
        pool: position.pool ?? null
      } satisfies InferredMellowStrategy;
    }
  }

  return null;
}

export function inferMellowStrategyFromTransaction(input: {
  walletAddress: string;
  transactionTarget: string | null;
  transfers: ObservedWalletTransfer[];
  positions: Iterable<KnownMellowPosition>;
}) {
  const knownStrategy = findKnownMellowStrategy({
    candidateAddresses: [
      input.transactionTarget,
      ...input.transfers.map((transfer) => transfer.tokenAddress)
    ],
    positions: input.positions
  });

  if (knownStrategy) {
    return knownStrategy;
  }

  const wrapperAddress = normalizeAddress(input.transactionTarget);
  if (!wrapperAddress) {
    return null;
  }

  const wrapperDelta = getNetTransferDelta({
    walletAddress: input.walletAddress,
    tokenAddress: wrapperAddress,
    transfers: input.transfers
  });
  if (wrapperDelta === 0n) {
    return null;
  }

  const principalTransfers = input.transfers.filter(
    (transfer) => !isAddressEqual(transfer.tokenAddress as `0x${string}`, wrapperAddress as `0x${string}`)
  );
  if (principalTransfers.length === 0) {
    return null;
  }

  const hasPrincipalInbound = principalTransfers.some((transfer) => isWalletInbound(transfer, input.walletAddress));
  const hasPrincipalOutbound = principalTransfers.some((transfer) => isWalletOutbound(transfer, input.walletAddress));

  if (wrapperDelta > 0n && !hasPrincipalOutbound) {
    return null;
  }

  if (wrapperDelta < 0n && !hasPrincipalInbound) {
    return null;
  }

  return {
    wrapperAddress,
    stakingRewardsAddress: null,
    sourceContractAddress: wrapperAddress,
    pool: null
  } satisfies InferredMellowStrategy;
}

export function inferMellowStakingRewardsAddress(input: {
  walletAddress: string;
  transactionTarget: string | null;
  wrapperAddress: string;
  transfers: ObservedWalletTransfer[];
}) {
  const candidateAddress = normalizeAddress(input.transactionTarget);
  if (!candidateAddress || candidateAddress === input.wrapperAddress.toLowerCase()) {
    return null;
  }

  const wrapperDelta = getNetTransferDelta({
    walletAddress: input.walletAddress,
    tokenAddress: input.wrapperAddress,
    transfers: input.transfers
  });
  if (wrapperDelta !== 0n) {
    return null;
  }

  const nonWrapperTransfers = input.transfers.filter(
    (transfer) => !isAddressEqual(transfer.tokenAddress as `0x${string}`, input.wrapperAddress as `0x${string}`)
  );
  if (nonWrapperTransfers.length === 0) {
    return null;
  }

  const hasInbound = nonWrapperTransfers.some((transfer) => isWalletInbound(transfer, input.walletAddress));
  const hasOutbound = nonWrapperTransfers.some((transfer) => isWalletOutbound(transfer, input.walletAddress));

  return hasInbound && !hasOutbound ? candidateAddress : null;
}