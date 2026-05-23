import type {
  OverviewProtocolPosition,
  ProtocolPositionCoverageReasonCode,
  ProtocolPositionFamily,
} from "@/server/protocol-positions/protocolPositions.types";

export type KnownProtocolContract = {
  chainId: number;
  address: string;
  protocol: string;
  contractType: string;
  metadataJson: Record<string, unknown>;
};

export type ProtocolMetadataIndex = {
  chainId: number;
  byAddress: Map<string, KnownProtocolContract>;
};

export const AERODROME_CL_POSITION_MANAGER_ADDRESS: Partial<Record<number, string>> = {
  8453: "0x827922686190790b37229fd06084350e74485b72",
};

const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const KEYWORD_GROUPS = {
  aerodrome: ["aerodrome", "aero", "veaero"],
  mellow: ["mellow"],
  governance: ["governance", "vote", "voting", "veaero", "lock", "escrow", "delegate"],
  strategy: ["strategy", "vault", "managed", "rebalance", "wrapper"],
  manual: ["liquidity", "position", "deposit", "concentrated", "mint", "collect"],
  stakedLp: ["staked", "staking", "gauge", "farm"],
} as const;

export function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : [];
}

export function normalizeAddress(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && ADDRESS_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

export function buildProtocolMetadataIndex(
  chainId: number,
  contracts: KnownProtocolContract[],
): ProtocolMetadataIndex {
  return {
    chainId,
    byAddress: new Map(
      contracts
        .map((contract) => [normalizeAddress(contract.address), contract] as const)
        .filter((entry): entry is [string, KnownProtocolContract] => Boolean(entry[0])),
    ),
  };
}

function collectValuesByKeyPattern(
  value: unknown,
  keyPattern: RegExp,
  depth = 0,
): unknown[] {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectValuesByKeyPattern(item, keyPattern, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const matches: unknown[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (keyPattern.test(key)) {
      matches.push(nestedValue);
    }

    matches.push(...collectValuesByKeyPattern(nestedValue, keyPattern, depth + 1));
  }

  return matches;
}

export function collectStringSignals(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStringSignals(item, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const signals: string[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (/(label|name|protocol|summary|symbol|type|category|description|surface|entity|method|title)/i.test(key)) {
      signals.push(...collectStringSignals(nestedValue, depth + 1));
      continue;
    }

    if (/(address|contract|wrapper|vault|pool|position|staking|token|nft)/i.test(key)) {
      const stringValue = asString(nestedValue);
      if (stringValue && !ADDRESS_PATTERN.test(stringValue)) {
        signals.push(stringValue);
      }
    }

    signals.push(...collectStringSignals(nestedValue, depth + 1));
  }

  return Array.from(new Set(signals));
}

export function collectAddressSignals(value: unknown, depth = 0): string[] {
  if (depth > 4 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "string") {
    const normalized = normalizeAddress(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAddressSignals(item, depth + 1));
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const addresses = Object.values(record).flatMap((nestedValue) =>
    collectAddressSignals(nestedValue, depth + 1),
  );

  return Array.from(new Set(addresses));
}

export function detectProtocolFromSignals(
  metadata: ProtocolMetadataIndex,
  signals: string[],
  addresses: string[],
): string | null {
  for (const address of addresses) {
    const contract = metadata.byAddress.get(address);
    if (contract) {
      return contract.protocol.toLowerCase();
    }
  }

  const haystack = signals.join(" ").toLowerCase();
  if (KEYWORD_GROUPS.mellow.some((keyword) => haystack.includes(keyword))) {
    return "mellow";
  }

  if (KEYWORD_GROUPS.aerodrome.some((keyword) => haystack.includes(keyword))) {
    return "aerodrome";
  }

  return null;
}

export function detectFamilyFromSignals(
  protocol: string | null,
  signals: string[],
  options?: {
    hasTokenId?: boolean;
    hasNftTransfers?: boolean;
  },
): ProtocolPositionFamily | null {
  if (!protocol) {
    return null;
  }

  const haystack = signals.join(" ").toLowerCase();

  if (KEYWORD_GROUPS.governance.some((keyword) => haystack.includes(keyword))) {
    return "governance_lock";
  }

  if (protocol === "mellow") {
    return "strategy_exposure";
  }

  if (KEYWORD_GROUPS.stakedLp.some((keyword) => haystack.includes(keyword))) {
    return "staked_lp";
  }

  if (
    protocol === "aerodrome" &&
    (options?.hasTokenId || options?.hasNftTransfers || KEYWORD_GROUPS.manual.some((keyword) => haystack.includes(keyword)))
  ) {
    return "manual_deposit";
  }

  if (KEYWORD_GROUPS.strategy.some((keyword) => haystack.includes(keyword))) {
    return "strategy_exposure";
  }

  return null;
}

export function extractUsdValue(value: unknown): number | null {
  const directCandidates = collectValuesByKeyPattern(
    value,
    /^(usd_value|value_usd|total_usd_value|usdValue|valueUsd|totalUsdValue|position_usd|positionUsd|net_usd_value|netUsdValue)$/i,
  )
    .map(asNumber)
    .filter((candidate): candidate is number => candidate !== null && candidate >= 0);

  if (directCandidates.length > 0) {
    return directCandidates[0] ?? null;
  }

  const arrayCandidates = collectValuesByKeyPattern(value, /^(tokens|assets|positions|items)$/i)
    .flatMap((candidate) => asRecordArray(candidate))
    .map((candidate) => extractUsdValue(candidate))
    .filter((candidate): candidate is number => candidate !== null && candidate >= 0);

  if (arrayCandidates.length > 0) {
    return arrayCandidates.reduce((sum, candidate) => sum + candidate, 0);
  }

  return null;
}

export function extractTokenSymbols(value: unknown) {
  const explicitSymbols = collectValuesByKeyPattern(value, /^(token_symbol|symbol|token0_symbol|token1_symbol|base_symbol|quote_symbol)$/i)
    .map(asString)
    .filter((candidate): candidate is string => Boolean(candidate));

  for (const signal of collectStringSignals(value)) {
    const mellowPairMatch = signal.match(/(?:MellowVelodromeStrategy:|MVS:)([A-Za-z0-9]+)-([A-Za-z0-9]+)-\d+/i);
    if (mellowPairMatch) {
      return {
        primaryTokenSymbol: mellowPairMatch[1] ?? null,
        secondaryTokenSymbol: mellowPairMatch[2] ?? null,
      };
    }

    const pairMatch = signal.match(/([A-Z0-9]{2,12})\s*\/\s*([A-Z0-9]{2,12})/);
    if (pairMatch) {
      return {
        primaryTokenSymbol: pairMatch[1] ?? null,
        secondaryTokenSymbol: pairMatch[2] ?? null,
      };
    }

    const hyphenPairMatch = signal.match(/([A-Z0-9]{2,12})-([A-Z0-9]{2,12})(?:-\d+)?/);
    if (hyphenPairMatch) {
      return {
        primaryTokenSymbol: hyphenPairMatch[1] ?? null,
        secondaryTokenSymbol: hyphenPairMatch[2] ?? null,
      };
    }
  }

  return {
    primaryTokenSymbol: explicitSymbols[0] ?? null,
    secondaryTokenSymbol: explicitSymbols[1] ?? null,
  };
}

export function extractTokenId(value: unknown) {
  const tokenId = collectValuesByKeyPattern(value, /^(token_id|tokenId|nft_token_id|position_id|positionId)$/i)
    .map(asString)
    .find(Boolean);

  return tokenId ?? null;
}

export function extractTimestamp(value: unknown) {
  const timestamp = collectValuesByKeyPattern(
    value,
    /^(updated_at|updatedAt|last_updated|lastUpdated|timestamp|block_timestamp|blockTime|created_at|createdAt)$/i,
  )
    .map(asString)
    .find(Boolean);

  return timestamp ?? null;
}

export function extractLockEndAt(value: unknown) {
  const lockEndAt = collectValuesByKeyPattern(value, /^(lock_end|lockEnd|unlock_at|unlockAt|expires_at|expiresAt)$/i)
    .map(asString)
    .find(Boolean);

  return lockEndAt ?? null;
}

export function buildProtocolPositionKey(input: {
  chainId: number;
  protocol: string;
  family: ProtocolPositionFamily;
  walletAddress: string;
  positionContractAddress?: string | null;
  wrapperAddress?: string | null;
  tokenId?: string | null;
  fallbackReference?: string | null;
}) {
  const familySegment = input.family.replace("_deposit", "").replace("_exposure", "");
  const reference =
    input.tokenId ??
    input.positionContractAddress ??
    input.wrapperAddress ??
    input.fallbackReference ??
    input.walletAddress.toLowerCase();

  const contractReference =
    input.positionContractAddress ??
    input.wrapperAddress ??
    input.fallbackReference ??
    "unknown";

  if (input.family === "manual_deposit") {
    return `${input.chainId}:${input.protocol}:${familySegment}:${contractReference}:${reference}`;
  }

  return `${input.chainId}:${input.protocol}:${familySegment}:${contractReference}:${input.walletAddress.toLowerCase()}`;
}

export function buildProtocolSurface(
  protocol: string,
  family: ProtocolPositionFamily,
): OverviewProtocolPosition["metadata"]["protocolSurface"] {
  if (protocol === "mellow") {
    return family === "strategy_exposure" ? "mellow_wrapper" : "mellow";
  }

  if (protocol === "aerodrome") {
    if (family === "manual_deposit") return "aerodrome_cl_nft";
    if (family === "governance_lock") return "aerodrome_governance";
    if (family === "staked_lp") return "aerodrome_staking";
  }

  return protocol;
}

export function buildProtocolLabel(input: {
  family: ProtocolPositionFamily;
  protocol: string;
  primaryTokenSymbol: string | null;
  secondaryTokenSymbol: string | null;
  strategyLabel: string | null;
  governanceLabel: string | null;
}) {
  const tokenPair = input.primaryTokenSymbol && input.secondaryTokenSymbol
    ? `${input.primaryTokenSymbol} / ${input.secondaryTokenSymbol}`
    : null;

  if (input.family === "manual_deposit") {
    return tokenPair ? `${tokenPair} manual position` : "Manual protocol position";
  }

  if (input.family === "strategy_exposure") {
    return input.strategyLabel ?? `${input.protocol} strategy exposure`;
  }

  if (input.family === "governance_lock") {
    return input.governanceLabel ?? `${input.protocol} governance lock`;
  }

  return tokenPair ? `${tokenPair} staked LP` : `${input.protocol} staked LP`;
}

export function buildMetadataReasonCodes(input: {
  family: ProtocolPositionFamily;
  valueUsd: number | null;
  positionContractAddress: string | null;
  wrapperAddress: string | null;
  tokenId: string | null;
}): ProtocolPositionCoverageReasonCode[] {
  const reasonCodes: ProtocolPositionCoverageReasonCode[] = [];

  if (!input.positionContractAddress && !input.wrapperAddress) {
    reasonCodes.push("positionMetadataIncomplete");
  }

  if (input.family === "manual_deposit" && !input.tokenId) {
    reasonCodes.push("positionMetadataIncomplete");
  }

  if (input.family === "strategy_exposure") {
    reasonCodes.push("strategyShareLevelOnly");
  }

  if (input.family === "governance_lock" && input.valueUsd === null) {
    reasonCodes.push("governanceValueUnavailable");
  }

  return Array.from(new Set(reasonCodes));
}

export function mergeProtocolCoverageReasonCodes(
  ...reasonCodeGroups: Array<ProtocolPositionCoverageReasonCode[] | null | undefined>
) {
  return Array.from(
    new Set(reasonCodeGroups.flatMap((group) => group ?? [])),
  );
}