import { engineV2ManagedLockLinks, engineV2ProtocolStateSnapshots } from "@/server/db/schema";

export function managedLockLinkValues(input: {
  chainId: number;
  walletAddress: string;
  userLockId: string;
  managedLockId?: string | null;
  userTokenId: string;
  managedTokenId: string;
  sourceDomainEventId?: string | null;
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2ManagedLockLinks.$inferInsert {
  return {
    chainId: input.chainId,
    walletAddress: input.walletAddress.toLowerCase(),
    userLockId: input.userLockId,
    managedLockId: input.managedLockId ?? null,
    userTokenId: input.userTokenId,
    managedTokenId: input.managedTokenId,
    evidenceJson: {
      relationKind: "deposited_managed",
      sourceDomainEventId: input.sourceDomainEventId ?? null,
      ...(input.evidenceJson ?? {}),
    },
  };
}

export function managedLockStateSnapshot(input: {
  chainId: number;
  votingEscrowAddress: string;
  userTokenId: string;
  managedTokenId?: string | null;
  blockNumber?: string | null;
  evidenceJson?: Record<string, unknown>;
}): typeof engineV2ProtocolStateSnapshots.$inferInsert {
  return {
    chainId: input.chainId,
    protocol: "aerodrome",
    subjectType: "managed_lock_relation",
    subjectAddress: input.votingEscrowAddress.toLowerCase(),
    subjectId: input.userTokenId,
    blockNumber: input.blockNumber ?? null,
    sourceProvider: "alchemy_eth_call",
    stateJson: { managedTokenId: input.managedTokenId ?? null },
    evidenceJson: input.evidenceJson ?? {},
  };
}
