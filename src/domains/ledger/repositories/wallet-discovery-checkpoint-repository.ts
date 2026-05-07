import { and, eq } from "drizzle-orm";

import { walletDiscoveryCheckpoints } from "@/infrastructure/db/schema";

type Database = ReturnType<typeof import("@/infrastructure/db/client").getDb>;

export type WalletDiscoveryCheckpointRecord = typeof walletDiscoveryCheckpoints.$inferSelect;

export class WalletDiscoveryCheckpointRepository {
  constructor(private readonly db: Database) {}

  private parseProviderStates(input: unknown) {
    if (!input || typeof input !== "object") {
      return {} as Record<string, { cursor: string | null; updatedAt: string }>;
    }

    return input as Record<string, { cursor: string | null; updatedAt: string }>;
  }

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
        providerStates: {},
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

  async getProviderCursor(walletAddress: string, chainId: number, providerAlias: string) {
    const checkpoint = await this.findByWallet(walletAddress, chainId);
    if (!checkpoint) {
      return null;
    }

    const providerStates = this.parseProviderStates(checkpoint.providerStates);
    return providerStates[providerAlias]?.cursor ?? null;
  }

  async upsertProviderCursor(input: {
    walletAddress: string;
    chainId: number;
    providerAlias: string;
    cursor: string | null;
  }) {
    const existing = await this.findByWallet(input.walletAddress, input.chainId);
    const providerStates = this.parseProviderStates(existing?.providerStates);
    providerStates[input.providerAlias] = {
      cursor: input.cursor,
      updatedAt: new Date().toISOString()
    };

    const [checkpoint] = await this.db
      .insert(walletDiscoveryCheckpoints)
      .values({
        walletAddress: input.walletAddress.toLowerCase(),
        chainId: input.chainId,
        providerKey: existing?.providerKey ?? input.providerAlias,
        latestIndexedBlock: existing?.latestIndexedBlock ?? null,
        latestHydratedBlock: existing?.latestHydratedBlock ?? null,
        latestAcceptedBlock: existing?.latestAcceptedBlock ?? null,
        providerCursor: existing?.providerCursor ?? null,
        providerStates,
        pendingReconstructionRunId: existing?.pendingReconstructionRunId ?? null,
        lastSyncedAt: existing?.lastSyncedAt ?? null,
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [walletDiscoveryCheckpoints.walletAddress, walletDiscoveryCheckpoints.chainId],
        set: {
          providerStates,
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