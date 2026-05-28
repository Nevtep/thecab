"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type DepositsTableDensity = "comfortable" | "compact";

export type DepositsTableColumnKey =
  | "position"
  | "pool"
  | "status"
  | "opened"
  | "closed"
  | "openedValue"
  | "currentValue"
  | "totalRewards"
  | "realizedPnl"
  | "unrealizedPnl"
  | "totalReturn"
  | "estApr"
  | "coverage"
  | "confidence";

export const DEPOSITS_DEFAULT_HIDDEN_COLUMNS: DepositsTableColumnKey[] = [
  "closed",
  "realizedPnl",
  "unrealizedPnl",
  "confidence",
];

export type DepositsViewPreferences = {
  density: DepositsTableDensity;
  hiddenColumns: DepositsTableColumnKey[];
};

const STORAGE_KEY_PREFIX = "cab:deposits:viewPrefs";
const KNOWN_COLUMN_KEYS: DepositsTableColumnKey[] = [
  "position",
  "pool",
  "status",
  "opened",
  "closed",
  "openedValue",
  "currentValue",
  "totalRewards",
  "realizedPnl",
  "unrealizedPnl",
  "totalReturn",
  "estApr",
  "coverage",
  "confidence",
];

function buildStorageKey(chainId: number, walletAddress: string) {
  return `${STORAGE_KEY_PREFIX}:${chainId}:${walletAddress.toLowerCase()}`;
}

function createDefaultPreferences(): DepositsViewPreferences {
  return {
    density: "comfortable",
    hiddenColumns: [...DEPOSITS_DEFAULT_HIDDEN_COLUMNS],
  };
}

function isValidColumn(value: string): value is DepositsTableColumnKey {
  return (KNOWN_COLUMN_KEYS as readonly string[]).includes(value);
}

function parsePreferences(raw: string | null): DepositsViewPreferences {
  if (!raw) return createDefaultPreferences();
  try {
    const parsed = JSON.parse(raw) as Partial<DepositsViewPreferences>;
    const density: DepositsTableDensity = parsed?.density === "compact" ? "compact" : "comfortable";
    const hiddenColumns = Array.isArray(parsed?.hiddenColumns)
      ? parsed.hiddenColumns.filter((value): value is DepositsTableColumnKey =>
          typeof value === "string" && isValidColumn(value),
        )
      : createDefaultPreferences().hiddenColumns;
    return { density, hiddenColumns };
  } catch {
    return createDefaultPreferences();
  }
}

export function useDepositsViewPreferences(input: { chainId: number; walletAddress: string | null }) {
  const storageKey = useMemo(() => {
    if (!input.walletAddress) return null;
    return buildStorageKey(input.chainId, input.walletAddress);
  }, [input.chainId, input.walletAddress]);

  const [preferences, setPreferences] = useState<DepositsViewPreferences>(createDefaultPreferences);

  useEffect(() => {
    if (!storageKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferences(createDefaultPreferences());
      return;
    }
    if (typeof window === "undefined") return;
    setPreferences(parsePreferences(window.localStorage.getItem(storageKey)));
  }, [storageKey]);

  const persist = useCallback(
    (next: DepositsViewPreferences) => {
      if (typeof window === "undefined" || !storageKey) return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Ignore quota/serialization errors — view prefs are non-essential.
      }
    },
    [storageKey],
  );

  const setDensity = useCallback(
    (density: DepositsTableDensity) => {
      setPreferences((prev) => {
        const next = { ...prev, density };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggleColumn = useCallback(
    (column: DepositsTableColumnKey, hidden: boolean) => {
      setPreferences((prev) => {
        const without = prev.hiddenColumns.filter((c) => c !== column);
        const next: DepositsViewPreferences = {
          ...prev,
          hiddenColumns: hidden ? [...without, column] : without,
        };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const resetPreferences = useCallback(() => {
    const defaults = createDefaultPreferences();
    setPreferences(defaults);
    persist(defaults);
  }, [persist]);

  return {
    preferences,
    setDensity,
    toggleColumn,
    resetPreferences,
  };
}
