import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeFunctionData,
  parseAbiParameters,
} from "viem";

import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { alchemyRpc } from "@/server/providers/alchemy/rpc";
import {
  insertProviderCachedResponse,
  readProviderCachedResponse,
} from "@/server/providers/provider-cache.repository";
import { readLatestOverviewPricePoints } from "@/server/overview/overview.repository";
import {
  AERODROME_CL_POSITION_MANAGER_ADDRESS,
  buildMetadataReasonCodes,
  buildProtocolLabel,
  buildProtocolPositionKey,
  buildProtocolSurface,
  normalizeAddress,
} from "@/server/protocol-positions/protocolMetadata";
import type {
  OverviewProtocolPosition,
  ProtocolPositionCoverageReasonCode,
} from "@/server/protocol-positions/protocolPositions.types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_ENUMERATED_POSITIONS = 50;
const Q96 = 2 ** 96;

const positionManagerFactoryAbi = [
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const positionManagerEnumerableAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "positions",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "tickSpacing", type: "int24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
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
const INVALID_AERODROME_POSITION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type PriceEntry = {
  priceUsd: number;
  pricedAt: string | null;
};

type TokenMetadata = {
  symbol: string | null;
  decimals: number | null;
};

type ManualPositionRpcState = {
  tokenId: string;
  token0Address: string;
  token1Address: string;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  poolAddress: string | null;
  currentTick: number | null;
  sqrtPriceX96: bigint | null;
};

export type ReadAerodromeManualPositionsResult = {
  rows: OverviewProtocolPosition[];
  providerPartial: boolean;
  failedTokenIds: string[];
  artifacts: {
    tokenIds: string[];
    failedTokenIds: string[];
    priceAddresses: string[];
    positions: Array<{
      tokenId: string;
      poolAddress: string | null;
      token0Address: string;
      token1Address: string;
      tickSpacing: number;
      tickLower: number;
      tickUpper: number;
      liquidity: string;
      currentTick: number | null;
      valueUsd: number | null;
    }>;
  } | null;
};

async function ethCall(input: {
  address: string;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}) {
  const data = encodeFunctionData({
    abi: input.abi,
    functionName: input.functionName,
    args: input.args,
  } as Parameters<typeof encodeFunctionData>[0]);

  const result = await alchemyRpc<`0x${string}`>("eth_call", [{ to: input.address, data }, "latest"]);
  return decodeFunctionResult({
    abi: input.abi,
    functionName: input.functionName,
    data: result,
  } as Parameters<typeof decodeFunctionResult>[0]);
}

async function readSlot0(address: string) {
  const result = await alchemyRpc<`0x${string}`>("eth_call", [{ to: address, data: slot0Selector }, "latest"]);
  const [sqrtPriceX96, tick] = decodeAbiParameters(slot0AbiParameters, result);

  return {
    sqrtPriceX96,
    tick,
  };
}

function buildInvalidPositionTokenCacheKey(chainId: number, tokenId: string) {
  return `aerodrome-manual-position-invalid:${chainId}:${tokenId}`;
}

function isInvalidPositionIdError(error: unknown) {
  return error instanceof Error && error.message.includes("execution reverted: ID");
}

async function readInvalidPositionTokenIds(chainId: number, tokenIds: string[]) {
  const results = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const cached = await readProviderCachedResponse<{ invalid: true }>({
        provider: "alchemy",
        endpoint: "/rpc/aerodrome/manual-position-invalid",
        chainId,
        walletAddress: null,
        cacheKey: buildInvalidPositionTokenCacheKey(chainId, tokenId),
        maxAgeMs: INVALID_AERODROME_POSITION_TOKEN_TTL_MS,
      });

      return [tokenId, cached?.invalid === true] as const;
    }),
  );

  return {
    cachedInvalidTokenIds: results.filter(([, isInvalid]) => isInvalid).map(([tokenId]) => tokenId),
    candidateTokenIds: results.filter(([, isInvalid]) => !isInvalid).map(([tokenId]) => tokenId),
  };
}

async function cacheInvalidPositionTokenId(chainId: number, tokenId: string) {
  await insertProviderCachedResponse({
    provider: "alchemy",
    endpoint: "/rpc/aerodrome/manual-position-invalid",
    chainId,
    walletAddress: null,
    cacheKey: buildInvalidPositionTokenCacheKey(chainId, tokenId),
    payload: { invalid: true },
    ttlMs: INVALID_AERODROME_POSITION_TOKEN_TTL_MS,
  });
}

function getSqrtRatioAtTick(tick: number) {
  return Math.pow(1.0001, tick / 2);
}

function computePositionAmounts(input: {
  liquidity: bigint;
  sqrtPriceX96: bigint;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  token0Decimals: number;
  token1Decimals: number;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}) {
  const liquidity = Number(input.liquidity);
  const currentSqrtPrice = Number(input.sqrtPriceX96) / Q96;

  if (!Number.isFinite(liquidity) || !Number.isFinite(currentSqrtPrice) || currentSqrtPrice <= 0) {
    return {
      token0Amount: null,
      token1Amount: null,
    };
  }

  const sqrtRatioLower = getSqrtRatioAtTick(input.tickLower);
  const sqrtRatioUpper = getSqrtRatioAtTick(input.tickUpper);

  let amount0Raw = 0;
  let amount1Raw = 0;

  if (input.currentTick <= input.tickLower) {
    amount0Raw = liquidity * ((sqrtRatioUpper - sqrtRatioLower) / (sqrtRatioLower * sqrtRatioUpper));
  } else if (input.currentTick < input.tickUpper) {
    amount0Raw = liquidity * ((sqrtRatioUpper - currentSqrtPrice) / (currentSqrtPrice * sqrtRatioUpper));
    amount1Raw = liquidity * (currentSqrtPrice - sqrtRatioLower);
  } else {
    amount1Raw = liquidity * (sqrtRatioUpper - sqrtRatioLower);
  }

  const amount0 = amount0Raw + Number(input.tokensOwed0);
  const amount1 = amount1Raw + Number(input.tokensOwed1);

  if (!Number.isFinite(amount0) || !Number.isFinite(amount1)) {
    return {
      token0Amount: null,
      token1Amount: null,
    };
  }

  return {
    token0Amount: amount0 / 10 ** input.token0Decimals,
    token1Amount: amount1 / 10 ** input.token1Decimals,
  };
}

function pickPriceTimestamp(...timestamps: Array<string | null>) {
  return timestamps.find((timestamp) => Boolean(timestamp)) ?? null;
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

function resolveRangeDisplayFractionDigits(token1Decimals: number | null, quoteTokenPriceUsd: number | null) {
  if (token1Decimals === null) {
    return null;
  }

  if (quoteTokenPriceUsd !== null && Number.isFinite(quoteTokenPriceUsd) && quoteTokenPriceUsd > 0) {
    return Math.max(0, Math.min(token1Decimals, Math.ceil(Math.log10(quoteTokenPriceUsd)) + 2));
  }

  return Math.max(0, token1Decimals - 1);
}

async function readTokenMetadata(addresses: string[]) {
  const metadataEntries: Array<readonly [string, TokenMetadata]> = await Promise.all(
    addresses.map(async (address) => {
      try {
        const [symbol, decimals] = await Promise.all([
          ethCall({ address, abi: erc20MetadataAbi, functionName: "symbol" }),
          ethCall({ address, abi: erc20MetadataAbi, functionName: "decimals" }),
        ]);

        return [
          address,
          {
            symbol: typeof symbol === "string" ? symbol : String(symbol),
            decimals: Number(decimals),
          },
        ] as const;
      } catch {
        return [address, { symbol: null, decimals: null }] as const;
      }
    }),
  );

  return new Map<string, TokenMetadata>(metadataEntries);
}

export async function readAerodromeManualPositions(input: {
  walletAddress: string;
  chainId: number;
  tokenIds?: string[];
  now?: Date;
}) : Promise<ReadAerodromeManualPositionsResult> {
  const now = input.now ?? new Date();
  const positionManagerAddress = AERODROME_CL_POSITION_MANAGER_ADDRESS[input.chainId] ?? null;

  if (!positionManagerAddress) {
    return {
      rows: [],
      providerPartial: false,
      failedTokenIds: [],
      artifacts: null,
    };
  }

  try {
    const requestedTokenIds = Array.from(new Set((input.tokenIds ?? []).filter(Boolean)));

    let tokenIds: string[] = requestedTokenIds;
    if (tokenIds.length === 0) {
      const ownedBalance = await ethCall({
        address: positionManagerAddress,
        abi: positionManagerEnumerableAbi,
        functionName: "balanceOf",
        args: [input.walletAddress],
      });
      const positionCount = Math.min(Number(ownedBalance), MAX_ENUMERATED_POSITIONS);

      if (positionCount === 0) {
        return {
          rows: [],
          providerPartial: false,
          failedTokenIds: [],
          artifacts: { tokenIds: [], failedTokenIds: [], priceAddresses: [], positions: [] },
        };
      }

      tokenIds = await Promise.all(
        Array.from({ length: positionCount }, (_, index) =>
          ethCall({
            address: positionManagerAddress,
            abi: positionManagerEnumerableAbi,
            functionName: "tokenOfOwnerByIndex",
            args: [input.walletAddress, BigInt(index)],
          }).then((tokenId) => String(tokenId)),
        ),
      );
    }

    if (tokenIds.length === 0) {
      return {
        rows: [],
        providerPartial: false,
        failedTokenIds: [],
        artifacts: { tokenIds: [], failedTokenIds: [], priceAddresses: [], positions: [] },
      };
    }

    const { cachedInvalidTokenIds, candidateTokenIds } = await readInvalidPositionTokenIds(
      input.chainId,
      tokenIds,
    );
    tokenIds = candidateTokenIds;

    if (tokenIds.length === 0) {
      return {
        rows: [],
        providerPartial: false,
        failedTokenIds: cachedInvalidTokenIds,
        artifacts: {
          tokenIds: requestedTokenIds,
          failedTokenIds: cachedInvalidTokenIds,
          priceAddresses: [],
          positions: [],
        },
      };
    }

    const factoryAddress = String(await ethCall({
      address: positionManagerAddress,
      abi: positionManagerFactoryAbi,
      functionName: "factory",
    }));

    const positionStateResults = await Promise.all(
      tokenIds.map(async (tokenId) => {
        try {
          const position = (await ethCall({
            address: positionManagerAddress,
            abi: positionManagerEnumerableAbi,
            functionName: "positions",
            args: [BigInt(tokenId)],
          })) as readonly unknown[];

          const token0Address = normalizeAddress(String(position[2])) ?? ZERO_ADDRESS;
          const token1Address = normalizeAddress(String(position[3])) ?? ZERO_ADDRESS;
          const tickSpacing = Number(position[4]);
          const tickLower = Number(position[5]);
          const tickUpper = Number(position[6]);
          const liquidity = position[7] as bigint;
          const tokensOwed0 = position[10] as bigint;
          const tokensOwed1 = position[11] as bigint;

          const poolAddress = String(await ethCall({
            address: factoryAddress,
            abi: clFactoryAbi,
            functionName: "getPool",
            args: [token0Address, token1Address, tickSpacing],
          }).catch(() => ZERO_ADDRESS));

          let currentTick: number | null = null;
          let sqrtPriceX96: bigint | null = null;
          if (poolAddress !== ZERO_ADDRESS) {
            const slot0 = await readSlot0(poolAddress).catch(() => null);
            currentTick = slot0 ? Number(slot0.tick) : null;
            sqrtPriceX96 = slot0?.sqrtPriceX96 ?? null;
          }

          return {
            tokenId,
            state: {
              tokenId,
              token0Address,
              token1Address,
              tickSpacing,
              tickLower,
              tickUpper,
              liquidity,
              tokensOwed0,
              tokensOwed1,
              poolAddress: poolAddress === ZERO_ADDRESS ? null : poolAddress,
              currentTick,
              sqrtPriceX96,
            } satisfies ManualPositionRpcState,
          };
        } catch (error) {
          if (isInvalidPositionIdError(error)) {
            await cacheInvalidPositionTokenId(input.chainId, tokenId);
          }

          return { tokenId, state: null };
        }
      }),
    );

    const failedTokenIds = [
      ...cachedInvalidTokenIds,
      ...positionStateResults
      .filter((result): result is { tokenId: string; state: null } => result.state === null)
      .map((result) => result.tokenId),
    ];
    const positionStates = positionStateResults
      .flatMap((result) => (result.state ? [result.state] : []));

    const uniqueTokenAddresses: string[] = Array.from(
      new Set(
        positionStates
          .flatMap((state: ManualPositionRpcState) => [state.token0Address, state.token1Address])
          .filter((address: string) => address !== ZERO_ADDRESS),
      ),
    );

    const [tokenMetadataMap, priceResult] = await Promise.all([
      readTokenMetadata(uniqueTokenAddresses),
      getCurrentTokenPricesByAddress(input.chainId, uniqueTokenAddresses).catch(() => null),
    ]);

    const priceMap = new Map<string, PriceEntry>();
    if (priceResult?.data) {
      for (const item of priceResult.data) {
        const address = normalizeAddress(item.address);
        const usdPrice = item.prices?.find((price) => price.currency === "usd") ?? item.prices?.[0];
        const parsedPrice = usdPrice ? Number(usdPrice.value) : NaN;
        if (!address || !Number.isFinite(parsedPrice)) {
          continue;
        }

        priceMap.set(address, {
          priceUsd: parsedPrice,
          pricedAt: usdPrice?.lastUpdatedAt ?? null,
        });
      }
    }

    const missingPriceAddresses = uniqueTokenAddresses.filter((address) => !priceMap.has(address));
    if (missingPriceAddresses.length > 0) {
      const storedPrices = await readLatestOverviewPricePoints({
        chainId: input.chainId,
        tokenAddresses: missingPriceAddresses,
      });

      for (const storedPrice of storedPrices) {
        const parsedPrice = Number(storedPrice.priceUsd);
        if (!Number.isFinite(parsedPrice)) {
          continue;
        }

        priceMap.set(storedPrice.tokenAddress, {
          priceUsd: parsedPrice,
          pricedAt: storedPrice.pricedAt?.toISOString() ?? null,
        });
      }
    }

    const rows: OverviewProtocolPosition[] = positionStates.map((state: ManualPositionRpcState) => {
      const token0Metadata = tokenMetadataMap.get(state.token0Address) ?? { symbol: null, decimals: null };
      const token1Metadata = tokenMetadataMap.get(state.token1Address) ?? { symbol: null, decimals: null };
      const hasCurrentState =
        state.currentTick !== null &&
        state.sqrtPriceX96 !== null &&
        token0Metadata.decimals !== null &&
        token1Metadata.decimals !== null;

      const tokenAmounts = hasCurrentState
        ? computePositionAmounts({
            liquidity: state.liquidity,
            sqrtPriceX96: state.sqrtPriceX96 as bigint,
            currentTick: state.currentTick as number,
            tickLower: state.tickLower,
            tickUpper: state.tickUpper,
            token0Decimals: token0Metadata.decimals as number,
            token1Decimals: token1Metadata.decimals as number,
            tokensOwed0: state.tokensOwed0,
            tokensOwed1: state.tokensOwed1,
          })
        : { token0Amount: null, token1Amount: null };

      const price0 = priceMap.get(state.token0Address) ?? null;
      const price1 = priceMap.get(state.token1Address) ?? null;
      const token0ValueUsd =
        tokenAmounts.token0Amount !== null && price0 ? tokenAmounts.token0Amount * price0.priceUsd : null;
      const token1ValueUsd =
        tokenAmounts.token1Amount !== null && price1 ? tokenAmounts.token1Amount * price1.priceUsd : null;
      const valueUsd = token0ValueUsd !== null && token1ValueUsd !== null
        ? token0ValueUsd + token1ValueUsd
        : null;

      const reasonCodes = buildMetadataReasonCodes({
        family: "manual_deposit",
        valueUsd,
        positionContractAddress: positionManagerAddress,
        wrapperAddress: null,
        tokenId: state.tokenId,
      });
      const coverageReasonCodes: ProtocolPositionCoverageReasonCode[] = hasCurrentState
        ? reasonCodes
        : Array.from(new Set([...reasonCodes, "positionMetadataIncomplete"]));
      const primaryTokenSymbol = token0Metadata.symbol;
      const secondaryTokenSymbol = token1Metadata.symbol;
      const rangeLowerPrice =
        token0Metadata.decimals !== null && token1Metadata.decimals !== null
          ? convertTickToToken1Price(state.tickLower, token0Metadata.decimals, token1Metadata.decimals)
          : null;
      const rangeUpperPrice =
        token0Metadata.decimals !== null && token1Metadata.decimals !== null
          ? convertTickToToken1Price(state.tickUpper, token0Metadata.decimals, token1Metadata.decimals)
          : null;
      const rangeDisplayFractionDigits = resolveRangeDisplayFractionDigits(
        token1Metadata.decimals,
        price1?.priceUsd ?? null,
      );

      return {
        positionKey: buildProtocolPositionKey({
          chainId: input.chainId,
          protocol: "aerodrome",
          family: "manual_deposit",
          walletAddress: input.walletAddress,
          positionContractAddress: positionManagerAddress,
          tokenId: state.tokenId,
        }),
        chainId: input.chainId,
        walletAddress: input.walletAddress.toLowerCase(),
        family: "manual_deposit",
        protocol: "aerodrome",
        label: buildProtocolLabel({
          family: "manual_deposit",
          protocol: "aerodrome",
          primaryTokenSymbol,
          secondaryTokenSymbol,
          strategyLabel: null,
          governanceLabel: null,
        }),
        status: "active",
        coverageStatus: valueUsd !== null ? "full" : "partial",
        coverageReasonCodes,
        valueUsd,
        valueStatus: valueUsd !== null ? "current" : "unavailable",
        valueUpdatedAt: pickPriceTimestamp(price0?.pricedAt ?? null, price1?.pricedAt ?? null) ?? now.toISOString(),
        primaryTokenSymbol,
        secondaryTokenSymbol,
        primaryTokenAmount: tokenAmounts.token0Amount,
        secondaryTokenAmount: tokenAmounts.token1Amount,
        poolLabel:
          primaryTokenSymbol && secondaryTokenSymbol
            ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
            : null,
        strategyLabel: null,
        governanceLabel: null,
        tokenId: state.tokenId,
        metadata: {
          protocolSurface: buildProtocolSurface("aerodrome", "manual_deposit"),
          wrapperAddress: null,
          positionContractAddress: positionManagerAddress,
          lockEndAt: null,
          feeTierLabel: formatFeeTierLabel(state.tickSpacing),
          rangeLowerTick: state.tickLower,
          rangeUpperTick: state.tickUpper,
          currentTick: state.currentTick,
          isInRange: isPositionInRange(state.currentTick, state.tickLower, state.tickUpper),
          rangeLowerPrice,
          rangeUpperPrice,
          rangeQuoteTokenSymbol: secondaryTokenSymbol,
          rangeDisplayFractionDigits,
        },
      } satisfies OverviewProtocolPosition;
    });

    return {
      rows,
      providerPartial: priceResult === null || rows.some((row: OverviewProtocolPosition) => row.valueUsd === null),
      failedTokenIds,
      artifacts: {
        tokenIds,
        failedTokenIds,
        priceAddresses: uniqueTokenAddresses,
        positions: positionStates.map((state: ManualPositionRpcState, index: number) => ({
          tokenId: state.tokenId,
          poolAddress: state.poolAddress,
          token0Address: state.token0Address,
          token1Address: state.token1Address,
          tickSpacing: state.tickSpacing,
          tickLower: state.tickLower,
          tickUpper: state.tickUpper,
          liquidity: state.liquidity.toString(),
          currentTick: state.currentTick,
          valueUsd: rows[index]?.valueUsd ?? null,
        })),
      },
    };
  } catch {
    return {
      rows: [],
      providerPartial: true,
      failedTokenIds: input.tokenIds ?? [],
      artifacts: null,
    };
  }
}