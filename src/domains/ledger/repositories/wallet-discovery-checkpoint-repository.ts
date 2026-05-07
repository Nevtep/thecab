import { and, eq } from "drizzle-orm";

import { walletDiscoveryCheckpoints } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type WalletDiscoveryCheckpointRecord = typeof walletDiscoveryCheckpoints.$inferSelect;

export class WalletDiscoveryCheckpointRepository {
  constructor(private readonly db: Database) {}

  async findByWallet(walletAddress: string, chainId: number): Promise<WalletDiscoveryCheckpointRecord | null> {
    const [checkpoint] = await this.db
      .select()
      .from(walletDiscoveryCheckpoints)
      .where(
        and(
          eq(walletDiscoveryCheckpoints.walletAddress, walletAddress.toLowerCase()),
          eq(walletDiscoveryCheckpoints.chainId, chainId)
        )
      )
      .limit(1);

    return checkpoint ?? null;
  }

  async upsert(input: {
    walletAddress: string;
    chainId: number;
    providerKey: string;
    latestIndexedBlock?: bigint | null;
    latestHydratedBlock?: bigint | null;
    latestAcceptedBlock?: bigint | null;
    providerCursor?: string | null;
    pendingReconstructionRunId?: string | null;
    lastSyncedAt?: Date | null;
  }) {
    const [checkpoint] = await this.db
      .insert(walletDiscoveryCheckpoints)
      .values({
        walletAddress: input.walletAddress.toLowerCase(),
        chainId: input.chainId,
        providerKey: input.providerKey,
        latestIndexedBlock: input.latestIndexedBlock,
        latestHydratedBlock: input.latestHydratedBlock,
        latestAcceptedBlock: input.latestAcceptedBlock,
        providerCursor: input.providerCursor ?? null,
        pendingReconstructionRunId: input.pendingReconstructionRunId ?? null,
        lastSyncedAt: input.lastSyncedAt ?? null,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [walletDiscoveryCheckpoints.walletAddress, walletDiscoveryCheckpoints.chainId],
        set: {
          providerKey: input.providerKey,
          latestIndexedBlock: input.latestIndexedBlock,
          latestHydratedBlock: input.latestHydratedBlock,
          latestAcceptedBlock: input.latestAcceptedBlock,
          providerCursor: input.providerCursor ?? null,
          pendingReconstructionRunId: input.pendingReconstructionRunId ?? null,
          lastSyncedAt: input.lastSyncedAt ?? null,
          updatedAt: new Date()
        }
      })
      .returning();

    return checkpoint ?? null;
  }

  async clearPendingRun(walletAddress: string, chainId: number, reconstructionRunId: string) {
    const [checkpoint] = await this.db
      .update(walletDiscoveryCheckpoints)
      .set({
        pendingReconstructionRunId: null,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(walletDiscoveryCheckpoints.walletAddress, walletAddress.toLowerCase()),
          eq(walletDiscoveryCheckpoints.chainId, chainId),
          eq(walletDiscoveryCheckpoints.pendingReconstructionRunId, reconstructionRunId)
        )
      )
      .returning();

    return checkpoint ?? null;
  }
}