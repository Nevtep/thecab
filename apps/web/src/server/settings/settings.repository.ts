import { and, eq, isNull, or } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { userPreferences } from "@/server/db/schema";
import type {
  SettingsPersistedPreferencePatch,
  SettingsPreferenceKey,
} from "@/server/settings/settings.types";

type ScopedWalletInput = {
  walletAddress: string;
  chainId: number;
};

export type StoredUserPreference = {
  key: SettingsPreferenceKey;
  chainId: number | null;
  valueJson: Record<string, unknown>;
};

export async function readPreferences(input: ScopedWalletInput): Promise<StoredUserPreference[]> {
  const db = getDb();
  const rows = await db
    .select({
      key: userPreferences.key,
      chainId: userPreferences.chainId,
      valueJson: userPreferences.valueJson,
    })
    .from(userPreferences)
    .where(
      and(
        eq(userPreferences.walletAddress, input.walletAddress.toLowerCase()),
        or(isNull(userPreferences.chainId), eq(userPreferences.chainId, input.chainId)),
      ),
    );

  return rows as StoredUserPreference[];
}

export async function upsertPreferences(
  input: ScopedWalletInput & { preferences: SettingsPersistedPreferencePatch },
): Promise<StoredUserPreference[]> {
  const db = getDb();
  const normalizedWalletAddress = input.walletAddress.toLowerCase();
  const writes: Array<{ key: SettingsPreferenceKey; chainId: number | null; valueJson: Record<string, unknown> }> = [];

  if (input.preferences.languagePreference) {
    writes.push({
      key: "languagePreference",
      chainId: null,
      valueJson: { locale: input.preferences.languagePreference },
    });
  }

  if (input.preferences.defaultOverviewRange) {
    writes.push({
      key: "defaultOverviewRange",
      chainId: input.chainId,
      valueJson: { range: input.preferences.defaultOverviewRange },
    });
  }

  if (writes.length === 0) {
    return readPreferences(input);
  }

  await db.transaction(async (tx) => {
    for (const write of writes) {
      const existingRows = await tx
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(
          and(
            eq(userPreferences.walletAddress, normalizedWalletAddress),
            eq(userPreferences.key, write.key),
            write.chainId === null
              ? isNull(userPreferences.chainId)
              : eq(userPreferences.chainId, write.chainId),
          ),
        )
        .limit(1);

      if (existingRows[0]) {
        await tx
          .update(userPreferences)
          .set({
            valueJson: write.valueJson,
            updatedAt: new Date(),
          })
          .where(eq(userPreferences.id, existingRows[0].id));
      } else {
        await tx.insert(userPreferences).values({
          walletAddress: normalizedWalletAddress,
          chainId: write.chainId,
          key: write.key,
          valueJson: write.valueJson,
        });
      }
    }
  });

  return readPreferences(input);
}