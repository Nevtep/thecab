import {
  decodeAbiParameters,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionData,
  parseAbiParameters,
} from "viem";

import { alchemyRpc } from "@/server/providers/alchemy";
import {
  decomposeTxEconomics,
  isHistoryRecordEconomicallyExcluded,
  type EconomicComponentKind,
  type SurfaceKind,
} from "@/server/analysis/txClassification";
import {
  AERODROME_CL_POSITION_MANAGER_ADDRESS,
  asRecordArray,
  asString,
  buildProtocolMetadataIndex,
  buildProtocolLabel,
  collectAddressSignals,
  collectStringSignals,
  detectProtocolFromSignals,
  extractTokenId,
  normalizeAddress,
  type KnownProtocolContract,
} from "@/server/protocol-positions/protocolMetadata";
import { readAerodromeManualPositions } from "@/server/protocol-positions/readAerodromeManualPositions";
import { reconstructRecentPositionState } from "@/server/protocol-positions/reconstructRecentPositionState";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type MoralisHistoryRecord = Record<string, unknown>;

type AerodromeMintParams = {
  token0Address: string;
  token1Address: string;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
};

type TokenMetadata = {
  symbol: string | null;
  decimals: number | null;
};

const aerodromeMintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [{
      name: "params",
      type: "tuple",
      components: [
        { name: "token0", type: "address" },
        { name: "token1", type: "address" },
        { name: "tickSpacing", type: "int24" },
        { name: "tickLower", type: "int24" },
        { name: "tickUpper", type: "int24" },
        { name: "amount0Desired", type: "uint256" },
        { name: "amount1Desired", type: "uint256" },
        { name: "amount0Min", type: "uint256" },
        { name: "amount1Min", type: "uint256" },
        { name: "recipient", type: "address" },
        { name: "deadline", type: "uint256" },
        { name: "sqrtPriceX96", type: "uint160" },
      ],
    }],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "liquidity", type: "uint128" },
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
] as const;

const aerodromeGaugeRewardAbi = [
  {
    type: "function",
    name: "getReward",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [],
  },
] as const;

const multicallAbi = [
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    type: "function",
    name: "multicall",
    stateMutability: "payable",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
] as const;

const positionManagerFactoryAbi = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const clFactoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "tickSpacing", type: "int24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const erc20MetadataAbi = [
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

const slot0Selector = "0x3850c7bd";
const slot0AbiParameters = parseAbiParameters(
  "uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, bool unlocked",
);

type AerodromeLifecycleAction = "mint" | "increaseLiquidity" | "decreaseLiquidity" | "collect";

export type AerodromeDepositLifecycleRecord = {
  txHash: string;
  occurredAt: Date;
  tokenId: string | null;
  action: AerodromeLifecycleAction;
  positionManagerAddress: string | null;
  poolAddress: string | null;
  category: string | null;
  methodLabel: string | null;
  summary: string | null;
};

export type DecodeAerodromeDepositLifecycleResult = {
  rows: OverviewProtocolPosition[];
  lifecycle: AerodromeDepositLifecycleRecord[];
  rewardCandidates: Array<{
    txHash: string;
    occurredAt: Date;
    category: string | null;
    summary: string | null;
    protocol: "aerodrome";
    targetType: "deposit";
    targetTokenId: string | null;
    targetPoolAddress?: string | null;
    componentKey?: string;
    economicComponentKind?: EconomicComponentKind;
    movementLogIndexes?: number[];
    /**
     * On-chain surface this candidate originated from. Drives ownership
     * resolution branching downstream. See
     * docs/spec/the-cab-aerodrome-claim-surfaces-research.md §6.
     */
    surfaceKind: SurfaceKind;
  }>;
  providerPartial: boolean;
  failedTokenIds: string[];
  artifacts: Awaited<ReturnType<typeof readAerodromeManualPositions>>["artifacts"];
};

export function resolveAerodromeRewardCandidateTokenId(input: {
  explicitTokenId: string | null;
  lifecycleTokenId: string | null;
}) {
  return input.explicitTokenId ?? input.lifecycleTokenId ?? null;
}

const REWARD_TOKEN_ID_KEY_PATTERN = /^(token_id|tokenId|token_ids|tokenIds|nft_token_id|position_id|positionId|position_ids|positionIds)$/i;

function normalizeTokenIdCandidates(value: unknown): string[] {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(Math.trunc(value))];
  }

  if (typeof value === "bigint") {
    return [value.toString()];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => normalizeTokenIdCandidates(entry));
  }

  return [];
}

function collectRewardTokenIdCandidates(value: unknown, depth = 0): string[] {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectRewardTokenIdCandidates(entry, depth + 1));
  }

  if (typeof value !== "object") {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates: string[] = [];
  for (const [key, nestedValue] of Object.entries(record)) {
    if (REWARD_TOKEN_ID_KEY_PATTERN.test(key)) {
      candidates.push(...normalizeTokenIdCandidates(nestedValue));
    }

    candidates.push(...collectRewardTokenIdCandidates(nestedValue, depth + 1));
  }

  return candidates;
}

export function extractAerodromeRewardRecordTokenId(record: MoralisHistoryRecord) {
  const directCandidates = Array.from(new Set([
    ...collectRewardTokenIdCandidates(record),
    ...(extractTokenId(record) ? [extractTokenId(record)] : []),
  ].filter((candidate): candidate is string => Boolean(candidate))));

  if (directCandidates.length === 1) {
    return directCandidates[0] ?? null;
  }

  return null;
}

export function extractAerodromeRewardTokenIdFromTransactionInput(
  data: `0x${string}` | string | null | undefined,
): string | null {
  if (!data || data === "0x") {
    return null;
  }

  try {
    const decoded = decodeFunctionData({
      abi: aerodromeGaugeRewardAbi,
      data: data as `0x${string}`,
    });
    if (decoded.functionName === "getReward") {
      const tokenId = decoded.args?.[0];
      if (typeof tokenId === "bigint") {
        return tokenId.toString();
      }
    }
  } catch {
    // Ignore and continue to multicall decoding.
  }

  try {
    const decoded = decodeFunctionData({
      abi: multicallAbi,
      data: data as `0x${string}`,
    });
    const nestedCalls = decoded.args?.at(-1);
    if (!Array.isArray(nestedCalls)) {
      return null;
    }

    for (const nestedCall of nestedCalls) {
      if (typeof nestedCall !== "string") {
        continue;
      }

      const tokenId = extractAerodromeRewardTokenIdFromTransactionInput(
        nestedCall as `0x${string}`,
      );
      if (tokenId) {
        return tokenId;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function resolveSameTxLifecycleTokenId(input: {
  txHash: string;
  lifecycleRecords: AerodromeDepositLifecycleRecord[];
}) {
  const tokenIds = Array.from(new Set(
    input.lifecycleRecords
      .filter((record) => record.txHash === input.txHash)
      .map((record) => record.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  ));

  return tokenIds.length === 1 ? (tokenIds[0] ?? null) : null;
}

function parseTimestamp(record: MoralisHistoryRecord) {
  const value = asString(record.block_timestamp) ?? asString(record.block_time) ?? asString(record.created_at);
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toFiniteInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }

  return null;
}

function normalizeMintParams(value: unknown): AerodromeMintParams | null {
  const raw = Array.isArray(value)
    ? {
        token0: value[0],
        token1: value[1],
        tickSpacing: value[2],
        tickLower: value[3],
        tickUpper: value[4],
      }
    : value && typeof value === "object"
      ? value as Record<string, unknown>
      : null;

  if (!raw) {
    return null;
  }

  const token0Address = normalizeAddress(raw.token0);
  const token1Address = normalizeAddress(raw.token1);
  const tickSpacing = toFiniteInteger(raw.tickSpacing);
  const tickLower = toFiniteInteger(raw.tickLower);
  const tickUpper = toFiniteInteger(raw.tickUpper);

  if (!token0Address || !token1Address || tickSpacing === null || tickLower === null || tickUpper === null) {
    return null;
  }

  return {
    token0Address,
    token1Address,
    tickSpacing,
    tickLower,
    tickUpper,
  };
}

export function extractAerodromeMintParamsFromTransactionInput(
  data: `0x${string}` | string | null | undefined,
): AerodromeMintParams | null {
  if (!data || data === "0x") {
    return null;
  }

  try {
    const decoded = decodeFunctionData({
      abi: aerodromeMintAbi,
      data: data as `0x${string}`,
    });
    if (decoded.functionName === "mint") {
      return normalizeMintParams(decoded.args?.[0] ?? null);
    }
  } catch {
    // Ignore and continue to multicall decoding.
  }

  try {
    const decoded = decodeFunctionData({
      abi: multicallAbi,
      data: data as `0x${string}`,
    });
    const nestedCalls = decoded.args?.at(-1);
    if (!Array.isArray(nestedCalls)) {
      return null;
    }

    for (const nestedCall of nestedCalls) {
      if (typeof nestedCall !== "string") {
        continue;
      }

      const params: AerodromeMintParams | null = extractAerodromeMintParamsFromTransactionInput(
        nestedCall as `0x${string}`,
      );
      if (params) {
        return params;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function ethCall(input: {
  address: string;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  chainId: number;
}) {
  const data = encodeFunctionData({
    abi: input.abi,
    functionName: input.functionName,
    args: input.args,
  } as Parameters<typeof encodeFunctionData>[0]);

  const result = await alchemyRpc<`0x${string}`>(
    "eth_call",
    [{ to: input.address, data }, "latest"],
    { chainId: input.chainId },
  );

  return decodeFunctionResult({
    abi: input.abi,
    functionName: input.functionName,
    data: result,
  } as Parameters<typeof decodeFunctionResult>[0]);
}

async function readSlot0Tick(input: { chainId: number; poolAddress: string }) {
  try {
    const result = await alchemyRpc<`0x${string}`>(
      "eth_call",
      [{ to: input.poolAddress, data: slot0Selector }, "latest"],
      { chainId: input.chainId },
    );
    const [, tick] = decodeAbiParameters(slot0AbiParameters, result);
    return Number(tick);
  } catch {
    return null;
  }
}

async function readTokenMetadata(addresses: string[], chainId: number) {
  const entries = await Promise.all(
    addresses.map(async (address) => {
      try {
        const [symbol, decimals] = await Promise.all([
          ethCall({ address, abi: erc20MetadataAbi, functionName: "symbol", chainId }),
          ethCall({ address, abi: erc20MetadataAbi, functionName: "decimals", chainId }),
        ]);

        return [address, {
          symbol: typeof symbol === "string" ? symbol : String(symbol),
          decimals: Number(decimals),
        } satisfies TokenMetadata] as const;
      } catch {
        return [address, { symbol: null, decimals: null } satisfies TokenMetadata] as const;
      }
    }),
  );

  return new Map<string, TokenMetadata>(entries);
}

function formatFeeTierLabel(tickSpacing: number | null) {
  return typeof tickSpacing === "number" && Number.isFinite(tickSpacing)
    ? String(tickSpacing)
    : null;
}

function isPositionInRange(currentTick: number | null, tickLower: number, tickUpper: number) {
  return currentTick !== null ? currentTick >= tickLower && currentTick < tickUpper : null;
}

function convertTickToToken1Price(tick: number, token0Decimals: number, token1Decimals: number) {
  return Math.pow(1.0001, tick) * 10 ** (token0Decimals - token1Decimals);
}

function resolveRangeDisplayFractionDigits(token1Decimals: number | null) {
  if (token1Decimals === null) {
    return null;
  }

  return Math.max(0, token1Decimals - 1);
}

async function resolvePoolAddressForMint(input: {
  chainId: number;
  positionManagerAddress: string | null;
  token0Address: string;
  token1Address: string;
  tickSpacing: number;
}) {
  if (!input.positionManagerAddress) {
    return null;
  }

  try {
    const factoryAddressResult = await ethCall({
      address: input.positionManagerAddress,
      abi: positionManagerFactoryAbi,
      functionName: "factory",
      chainId: input.chainId,
    });
    const factoryAddress = normalizeAddress(
      typeof factoryAddressResult === "string" ? factoryAddressResult : null,
    );

    if (!factoryAddress) {
      return null;
    }

    const poolAddressResult = await ethCall({
      address: factoryAddress,
      abi: clFactoryAbi,
      functionName: "getPool",
      args: [input.token0Address, input.token1Address, input.tickSpacing],
      chainId: input.chainId,
    });

    return normalizeAddress(
      typeof poolAddressResult === "string" ? poolAddressResult : null,
    );
  } catch {
    return null;
  }
}

async function buildHistoricalRangeBackfilledRows(input: {
  walletAddress: string;
  chainId: number;
  lifecycle: AerodromeDepositLifecycleRecord[];
  reconstructedRows: OverviewProtocolPosition[];
  failedTokenIds: Set<string>;
}) {
  const candidateRows = input.reconstructedRows.filter((row) =>
    row.protocol === "aerodrome"
    && (row.family === "manual_deposit" || row.family === "staked_lp")
    && typeof row.tokenId === "string"
    && input.failedTokenIds.has(row.tokenId),
  );

  const mintRecordByTokenId = new Map(
    input.lifecycle
      .filter((record) => record.action === "mint" && typeof record.tokenId === "string" && record.tokenId.length > 0)
      .map((record) => [record.tokenId as string, record] as const),
  );

  const decodedStates = await Promise.all(
    Array.from(new Set(candidateRows.map((row) => row.tokenId as string))).map(async (tokenId) => {
      const mintRecord = mintRecordByTokenId.get(tokenId) ?? null;
      if (!mintRecord) {
        return null;
      }

      try {
        const tx = await alchemyRpc<{ input?: `0x${string}` | string | null }>(
          "eth_getTransactionByHash",
          [mintRecord.txHash],
          { chainId: input.chainId },
        );
        const mintParams = extractAerodromeMintParamsFromTransactionInput(tx?.input ?? null);
        if (!mintParams) {
          return null;
        }

        const positionManagerAddress =
          mintRecord.positionManagerAddress
          ?? AERODROME_CL_POSITION_MANAGER_ADDRESS[input.chainId]
          ?? null;
        const poolAddress =
          mintRecord.poolAddress
          ?? await resolvePoolAddressForMint({
            chainId: input.chainId,
            positionManagerAddress,
            token0Address: mintParams.token0Address,
            token1Address: mintParams.token1Address,
            tickSpacing: mintParams.tickSpacing,
          });
        const currentTick = poolAddress
          ? await readSlot0Tick({ chainId: input.chainId, poolAddress })
          : null;

        return {
          tokenId,
          mintParams,
          positionManagerAddress,
          poolAddress,
          currentTick,
        };
      } catch {
        return null;
      }
    }),
  );

  const successfulStates = decodedStates.filter((state): state is NonNullable<typeof state> => Boolean(state));
  if (successfulStates.length === 0) {
    return [];
  }

  const tokenMetadata = await readTokenMetadata(
    Array.from(
      new Set(
        successfulStates.flatMap((state) => [state.mintParams.token0Address, state.mintParams.token1Address]),
      ),
    ),
    input.chainId,
  );

  const stateByTokenId = new Map(successfulStates.map((state) => [state.tokenId, state] as const));

  return candidateRows.flatMap((row) => {
    const state = stateByTokenId.get(row.tokenId as string) ?? null;
    if (!state) {
      return [];
    }

    const token0Metadata = tokenMetadata.get(state.mintParams.token0Address) ?? { symbol: null, decimals: null };
    const token1Metadata = tokenMetadata.get(state.mintParams.token1Address) ?? { symbol: null, decimals: null };
    const primaryTokenSymbol = token0Metadata.symbol ?? row.primaryTokenSymbol;
    const secondaryTokenSymbol = token1Metadata.symbol ?? row.secondaryTokenSymbol;
    const rangeLowerPrice =
      token0Metadata.decimals !== null && token1Metadata.decimals !== null
        ? convertTickToToken1Price(state.mintParams.tickLower, token0Metadata.decimals, token1Metadata.decimals)
        : null;
    const rangeUpperPrice =
      token0Metadata.decimals !== null && token1Metadata.decimals !== null
        ? convertTickToToken1Price(state.mintParams.tickUpper, token0Metadata.decimals, token1Metadata.decimals)
        : null;

    return [{
      ...row,
      label: buildProtocolLabel({
        family: row.family,
        protocol: "aerodrome",
        primaryTokenSymbol,
        secondaryTokenSymbol,
        strategyLabel: null,
        governanceLabel: null,
      }),
      primaryTokenSymbol,
      secondaryTokenSymbol,
      poolLabel:
        primaryTokenSymbol && secondaryTokenSymbol
          ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
          : row.poolLabel,
      metadata: {
        ...row.metadata,
        positionContractAddress: state.positionManagerAddress ?? row.metadata.positionContractAddress,
        poolAddress: state.poolAddress ?? row.metadata.poolAddress,
        feeTierLabel: formatFeeTierLabel(state.mintParams.tickSpacing),
        rangeLowerTick: state.mintParams.tickLower,
        rangeUpperTick: state.mintParams.tickUpper,
        currentTick: state.currentTick,
        isInRange: isPositionInRange(state.currentTick, state.mintParams.tickLower, state.mintParams.tickUpper),
        rangeLowerPrice,
        rangeUpperPrice,
        rangeQuoteTokenSymbol: secondaryTokenSymbol,
        rangeDisplayFractionDigits: resolveRangeDisplayFractionDigits(token1Metadata.decimals),
      },
    } satisfies OverviewProtocolPosition];
  });
}

function extractTxHash(record: MoralisHistoryRecord) {
  return (asString(record.transaction_hash) ?? asString(record.hash))?.toLowerCase() ?? null;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function recordHasNftBurn(record: MoralisHistoryRecord): boolean {
  const transfers = asRecordArray(record.nft_transfers);
  return transfers.some((transfer) => {
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return to === ZERO_ADDRESS;
  });
}

function recordHasNftTransferOut(record: MoralisHistoryRecord, walletAddress: string): boolean {
  const wallet = normalizeAddress(walletAddress);
  if (!wallet) return false;
  const transfers = asRecordArray(record.nft_transfers);
  return transfers.some((transfer) => {
    const from = normalizeAddress(asString(transfer.from_address) ?? asString(transfer.from));
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return from === wallet && to !== null && to !== wallet;
  });
}

function recordHasErc20ReceiveFrom(
  record: MoralisHistoryRecord,
  walletAddress: string,
  senderAddresses: Set<string>,
): boolean {
  const wallet = normalizeAddress(walletAddress);
  if (!wallet || senderAddresses.size === 0) return false;
  const transfers = asRecordArray(record.erc20_transfers);
  return transfers.some((transfer) => {
    const from = normalizeAddress(asString(transfer.from_address) ?? asString(transfer.from));
    const to = normalizeAddress(asString(transfer.to_address) ?? asString(transfer.to));
    return to === wallet && from !== null && senderAddresses.has(from);
  });
}

function extractLifecycleAction(
  record: MoralisHistoryRecord,
  context?: { walletAddress?: string },
): AerodromeLifecycleAction | null {
  // Only inspect curated fields. Descending into `collectStringSignals(record)`
  // pulls in decoded ABI method names / nested metadata that can include words
  // like "burn" or "decrease" even for a mint tx, leading to misclassification.
  const text = [
    asString(record.category),
    asString(record.method_label),
    asString(record.summary),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Mint first: the mint tx may also include an NFT transfer (from 0x0) plus
  // a multicall method label. Detect it explicitly before close-shaped checks.
  if (text.includes("mint") || text.includes("deposit")) {
    return "mint";
  }

  if (text.includes("increase")) {
    return "increaseLiquidity";
  }

  // Close-shaped transactions. Aerodrome NFT positions can close via a
  // multicall that bundles decreaseLiquidity + collect + burn, or via a
  // direct NFT burn / transfer-out. Match any of those shapes so the close
  // is recorded even when Moralis labels the tx generically.
  if (
    text.includes("decrease")
    || text.includes("withdraw")
    || text.includes("remove")
    || text.includes("burn")
    || text.includes("exit")
    || text.includes("redeem")
    || text.includes("unwind")
    || recordHasNftBurn(record)
    || (context?.walletAddress ? recordHasNftTransferOut(record, context.walletAddress) : false)
  ) {
    return "decreaseLiquidity";
  }

  if (text.includes("collect") || text.includes("claim")) {
    return "collect";
  }

  return null;
}

function extractLifecycleTokenId(record: MoralisHistoryRecord) {
  return extractAerodromeRewardRecordTokenId(record) ?? extractTokenId(asRecordArray(record.nft_transfers)[0] ?? null);
}

function buildLifecycleRecords(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
}) {
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const lifecycle: AerodromeDepositLifecycleRecord[] = [];

  for (const record of input.history) {
    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) {
      continue;
    }

    const addresses = collectAddressSignals(record);
    const signals = collectStringSignals(record);
    const protocol = detectProtocolFromSignals(metadata, signals, addresses);
    if (protocol !== "aerodrome") {
      continue;
    }

    const action = extractLifecycleAction(record, { walletAddress: input.walletAddress });
    if (!action) {
      continue;
    }

    const tokenId = extractLifecycleTokenId(record);
    const knownContracts = addresses.filter((address) => metadata.byAddress.has(address));
    const touchesGauge = knownContracts.some((address) =>
      metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"),
    );
    if (touchesGauge && action !== "collect") {
      continue;
    }

    const gaugePoolAddresses = knownContracts
      .filter((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"))
      .map((address) => normalizeAddress(asString(metadata.byAddress.get(address)?.metadataJson.poolAddress)))
      .filter((value): value is string => Boolean(value));

    const positionManagerAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("position"))
        ?? knownContracts[0]
        ?? null,
    );
    const poolAddress = normalizeAddress(
      knownContracts.find((address) => metadata.byAddress.get(address)?.contractType.toLowerCase().includes("pool"))
        ?? (gaugePoolAddresses.length === 1 ? gaugePoolAddresses[0] : null)
        ?? null,
    );

    lifecycle.push({
      txHash,
      occurredAt,
      tokenId,
      action,
      positionManagerAddress,
      poolAddress,
      category: asString(record.category),
      methodLabel: asString(record.method_label),
      summary: asString(record.summary),
    });
  }

  return lifecycle.sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
}

type GaugeRewardCandidate = {
  txHash: string;
  occurredAt: Date;
  category: string | null;
  summary: string | null;
  targetTokenId: string | null;
};

async function backfillGaugeRewardCandidateTokenIds(input: {
  chainId: number;
  candidates: GaugeRewardCandidate[];
}) {
  const missingTxHashes = Array.from(new Set(
    input.candidates
      .filter((candidate) => !candidate.targetTokenId)
      .map((candidate) => candidate.txHash),
  ));

  if (missingTxHashes.length === 0) {
    return input.candidates;
  }

  const tokenIdByTxHash = new Map<string, string | null>(
    await Promise.all(
      missingTxHashes.map(async (txHash) => {
        try {
          const tx = await alchemyRpc<{ input?: `0x${string}` | string | null }>(
            "eth_getTransactionByHash",
            [txHash],
            { chainId: input.chainId },
          );
          return [
            txHash,
            extractAerodromeRewardTokenIdFromTransactionInput(tx?.input ?? null),
          ] as const;
        } catch {
          return [txHash, null] as const;
        }
      }),
    ),
  );

  return input.candidates.map((candidate) => ({
    ...candidate,
    targetTokenId: candidate.targetTokenId ?? tokenIdByTxHash.get(candidate.txHash) ?? null,
  }));
}

/**
 * Detect ERC20 receives from known Aerodrome gauges. Moralis labels these as
 * "token receive" entries, never as "claim"/"collect", so they are not picked
 * up by `extractLifecycleAction`. They must NOT be added to the deposit
 * lifecycle (which would create spurious deposit rows under the gauge address),
 * only emitted as reward candidates so the historical classifier can attribute them.
 */
function buildGaugeRewardCandidates(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
}): GaugeRewardCandidate[] {
  const metadata = buildProtocolMetadataIndex(input.chainId, input.protocolContracts);
  const candidates: GaugeRewardCandidate[] = [];

  for (const record of input.history) {
    // Spec: spam/airdrop records are excluded from the economic pipeline before
    // any reward candidate is generated. See
    // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §4.
    if (isHistoryRecordEconomicallyExcluded(record)) continue;

    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    if (!txHash || !occurredAt) continue;

    const addresses = collectAddressSignals(record);
    const knownContracts = addresses.filter((address) => metadata.byAddress.has(address));
    const gaugeAddresses = new Set(
      knownContracts.filter((address) =>
        metadata.byAddress.get(address)?.contractType.toLowerCase().includes("gauge"),
      ),
    );
    if (gaugeAddresses.size === 0) continue;

    if (!recordHasErc20ReceiveFrom(record, input.walletAddress, gaugeAddresses)) continue;

    candidates.push({
      txHash,
      occurredAt,
      category: asString(record.category),
      summary: asString(record.summary),
      targetTokenId: extractAerodromeRewardRecordTokenId(record),
    });
  }

  return candidates;
}

function extractPoolFeeClaimCandidates(input: {
  walletAddress: string;
  history: MoralisHistoryRecord[];
}): DecodeAerodromeDepositLifecycleResult["rewardCandidates"] {
  const walletAddress = input.walletAddress.toLowerCase();
  return input.history.flatMap((record) => {
    if (isHistoryRecordEconomicallyExcluded(record)) return [];

    const txHash = extractTxHash(record);
    const occurredAt = parseTimestamp(record);
    const methodLabel = asString(record.method_label)?.toLowerCase() ?? "";
    if (!txHash || !occurredAt || methodLabel !== "claimfees") {
      return [];
    }

    const inboundTransfers = asRecordArray(record.erc20_transfers).filter((transfer) =>
      asString(transfer.to_address)?.toLowerCase() === walletAddress &&
      asString(transfer.from_address)?.toLowerCase()
    );
    const sourceAddresses = new Set(
      inboundTransfers
        .map((transfer) => asString(transfer.from_address)?.toLowerCase() ?? null)
        .filter((address): address is string => Boolean(address)),
    );
    if (inboundTransfers.length === 0 || sourceAddresses.size !== 1) {
      return [];
    }

    const poolAddress = [...sourceAddresses][0] ?? null;
    const components = decomposeTxEconomics({
      txHash,
      record,
      surfaceKind: "pool_fee_claim",
    });

    return components
      .filter((component) => component.kind === "fee_claim")
      .map((component) => ({
        txHash,
        occurredAt,
        category: asString(record.category),
        summary: asString(record.summary),
        protocol: "aerodrome" as const,
        targetType: "deposit" as const,
        targetTokenId: null,
        targetPoolAddress: poolAddress,
        surfaceKind: "pool_fee_claim" as SurfaceKind,
        componentKey: component.componentKey,
        economicComponentKind: component.kind,
        movementLogIndexes: component.movementLogIndexes,
      }));
  });
}

export async function decodeAerodromeDepositLifecycle(input: {
  walletAddress: string;
  chainId: number;
  history: MoralisHistoryRecord[];
  protocolContracts: KnownProtocolContract[];
  now?: Date;
}): Promise<DecodeAerodromeDepositLifecycleResult> {
  const now = input.now ?? new Date();
  const lifecycle = buildLifecycleRecords(input);
  const manualTokenIds = Array.from(
    new Set(
      lifecycle
        .map((record) => record.tokenId)
        .filter((tokenId): tokenId is string => Boolean(tokenId)),
    ),
  );

  const [currentState, reconstructed] = await Promise.all([
    readAerodromeManualPositions({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      tokenIds: manualTokenIds,
      now,
    }),
    Promise.resolve(
      reconstructRecentPositionState({
        walletAddress: input.walletAddress,
        chainId: input.chainId,
        history: input.history,
        protocolMetadata: buildProtocolMetadataIndex(input.chainId, input.protocolContracts),
        now,
      }),
    ),
  ]);

  const currentTokenIds = new Set(
    currentState.rows
      .map((row) => row.tokenId)
      .filter((tokenId): tokenId is string => Boolean(tokenId)),
  );
  const failedTokenIds = new Set(currentState.failedTokenIds);
  const historicalRangeBackfilledRows = await buildHistoricalRangeBackfilledRows({
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    lifecycle,
    reconstructedRows: reconstructed.rows,
    failedTokenIds,
  });
  const reconstructedRows = reconstructed.rows.filter((row) => {
    if (row.protocol !== "aerodrome") {
      return false;
    }

    if (row.family === "manual_deposit" && row.tokenId) {
      return !currentTokenIds.has(row.tokenId) && !failedTokenIds.has(row.tokenId);
    }

    return row.family === "staked_lp";
  });

  const gaugeRewardCandidates = await backfillGaugeRewardCandidateTokenIds({
    chainId: input.chainId,
    candidates: buildGaugeRewardCandidates({
      walletAddress: input.walletAddress,
      chainId: input.chainId,
      history: input.history,
      protocolContracts: input.protocolContracts,
    }),
  });

  // Skip gauge candidates that share a tx hash with a lifecycle-derived collect
  // (to avoid emitting the same reward twice).
  const lifecycleCollectTxHashes = new Set(
    lifecycle.filter((record) => record.action === "collect").map((record) => record.txHash),
  );
  const dedupedGaugeCandidates = gaugeRewardCandidates.filter(
    (candidate) => !lifecycleCollectTxHashes.has(candidate.txHash),
  );
  const feeClaimCandidates = extractPoolFeeClaimCandidates({
    walletAddress: input.walletAddress,
    history: input.history,
  });

  return {
    rows: [...currentState.rows, ...reconstructedRows, ...historicalRangeBackfilledRows],
    lifecycle,
    rewardCandidates: [
      ...lifecycle
        .filter((record) => record.action === "collect")
        .map((record) => ({
          txHash: record.txHash,
          occurredAt: record.occurredAt,
          category: record.category,
          summary: record.summary,
          protocol: "aerodrome" as const,
          targetType: "deposit" as const,
          targetTokenId: resolveAerodromeRewardCandidateTokenId({
            explicitTokenId: null,
            lifecycleTokenId: record.tokenId,
          }),
          // Spec: a lifecycle `collect` is a per-NFT manual deposit claim by
          // construction (the NPM/CL contracts only collect against a tokenId).
          surfaceKind: "manual_deposit_gauge_claim" as SurfaceKind,
          componentKey: `${record.txHash}:reward_claim`,
          economicComponentKind: "reward_claim" as const,
        })),
      ...dedupedGaugeCandidates.map((candidate) => {
        const resolvedTokenId = resolveAerodromeRewardCandidateTokenId({
          explicitTokenId: candidate.targetTokenId,
          lifecycleTokenId: resolveSameTxLifecycleTokenId({
            txHash: candidate.txHash,
            lifecycleRecords: lifecycle,
          }),
        });
        // Spec: when the gauge receive cannot be tied to a tokenId via the
        // tx input or a same-tx lifecycle record, the surface is the
        // per-LP-address `getReward(address)` (v2) flow which the current
        // taxonomy does not own. Mark it `gauge_reward_unknown_surface` so
        // the historical classifier can short-circuit to `unknownRewardSurface` instead
        // of falling through to `missingTokenId`. See
        // docs/spec/the-cab-aerodrome-claim-surfaces-research.md §2.4 + §6.
        const surfaceKind: SurfaceKind = resolvedTokenId
          ? "manual_deposit_gauge_claim"
          : "gauge_reward_unknown_surface";
        return {
          txHash: candidate.txHash,
          occurredAt: candidate.occurredAt,
          category: candidate.category,
          summary: candidate.summary,
          protocol: "aerodrome" as const,
          targetType: "deposit" as const,
          targetTokenId: resolvedTokenId,
          surfaceKind,
          componentKey: `${candidate.txHash}:reward_claim`,
          economicComponentKind: "reward_claim" as const,
        };
      }),
      ...feeClaimCandidates,
    ],
    providerPartial: currentState.providerPartial,
    failedTokenIds: currentState.failedTokenIds,
    artifacts: currentState.artifacts,
  };
}
