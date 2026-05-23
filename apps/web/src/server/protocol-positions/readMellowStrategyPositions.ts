import {
  decodeAbiParameters,
  decodeFunctionResult,
  encodeFunctionData,
  parseAbiParameters,
} from "viem";

import { getCurrentTokenPricesByAddress } from "@/server/providers/alchemy";
import { alchemyRpc } from "@/server/providers/alchemy/rpc";
import { readLatestOverviewPricePoints } from "@/server/overview/overview.repository";
import {
  asString,
  buildMetadataReasonCodes,
  buildProtocolLabel,
  buildProtocolPositionKey,
  buildProtocolSurface,
  normalizeAddress,
} from "@/server/protocol-positions/protocolMetadata";
import type { OverviewProtocolPosition } from "@/server/protocol-positions/protocolPositions.types";

type WalletTokenRecord = Record<string, unknown>;

type PriceEntry = {
  priceUsd: number;
  pricedAt: string | null;
};

type TokenMetadata = {
  symbol: string | null;
  decimals: number | null;
};

type MellowWrapperPositionInfo = {
  tokenId: string | null;
  tickSpacing: number | null;
  tickLower: number | null;
  tickUpper: number | null;
  liquidity: bigint;
};

type MellowWrapperState = {
  wrapperAddress: string;
  strategyLabel: string;
  tokenId: string | null;
  feeTierLabel: string | null;
  shareBalanceRaw: bigint;
  token0Address: string;
  token1Address: string;
  token0AmountRaw: bigint;
  token1AmountRaw: bigint;
};

export type ReadMellowStrategyPositionsResult = {
  rows: OverviewProtocolPosition[];
  providerPartial: boolean;
  artifacts: {
    wrappers: Array<{
      wrapperAddress: string;
      strategyLabel: string;
      tokenId: string | null;
      feeTierLabel: string | null;
      shareBalanceRaw: string;
      token0Address: string;
      token1Address: string;
      token0AmountRaw: string;
      token1AmountRaw: string;
      valueUsd: number | null;
    }>;
    priceAddresses: string[];
  } | null;
};

const wrapperStrategyAbi = [
  {
    type: "function",
    name: "token0",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "token1",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "previewMint",
    stateMutability: "view",
    inputs: [{ name: "lpAmount", type: "uint256" }],
    outputs: [
      { name: "amount0", type: "uint256" },
      { name: "amount1", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getInfo",
    stateMutability: "view",
    inputs: [],
    outputs: [{
      name: "data",
      type: "tuple[]",
      components: [
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
        { name: "tokenId", type: "uint256" },
      ],
    }],
  },
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
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

function isMellowStrategyToken(position: WalletTokenRecord) {
  const symbol = asString(position.symbol)?.toLowerCase() ?? "";
  const name = asString(position.name)?.toLowerCase() ?? "";

  return symbol.startsWith("mvs:") || name.startsWith("mellowvelodromestrategy:");
}

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

async function readTokenMetadata(addresses: string[]) {
  const entries: Array<readonly [string, TokenMetadata]> = await Promise.all(
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

  return new Map<string, TokenMetadata>(entries);
}

async function readSlot0(address: string) {
  const result = await alchemyRpc<`0x${string}`>("eth_call", [{ to: address, data: slot0Selector }, "latest"]);
  const [, tick] = decodeAbiParameters(slot0AbiParameters, result);

  return {
    tick: Number(tick),
  };
}

function normalizeTokenAmount(rawAmount: bigint, decimals: number | null) {
  if (decimals === null) {
    return null;
  }

  const numericAmount = Number(rawAmount);
  if (!Number.isFinite(numericAmount)) {
    return null;
  }

  return numericAmount / 10 ** decimals;
}

function pickPriceTimestamp(...timestamps: Array<string | null>) {
  return timestamps.find((timestamp) => Boolean(timestamp)) ?? null;
}

function formatFeeTierLabel(tickSpacing: number | null) {
  return typeof tickSpacing === "number" && Number.isFinite(tickSpacing)
    ? String(tickSpacing)
    : null;
}

function selectPrimaryPositionInfo(
  positions: MellowWrapperPositionInfo[],
  currentTick: number | null,
) {
  const ranked = [...positions].sort((left, right) => {
    const leftInRange = currentTick !== null
      ? left.tickLower !== null && left.tickUpper !== null && currentTick >= left.tickLower && currentTick < left.tickUpper
      : false;
    const rightInRange = currentTick !== null
      ? right.tickLower !== null && right.tickUpper !== null && currentTick >= right.tickLower && currentTick < right.tickUpper
      : false;

    if (leftInRange !== rightInRange) {
      return leftInRange ? -1 : 1;
    }

    if (left.liquidity !== right.liquidity) {
      return left.liquidity > right.liquidity ? -1 : 1;
    }

    const leftTokenId = BigInt(left.tokenId ?? "0");
    const rightTokenId = BigInt(right.tokenId ?? "0");
    if (leftTokenId !== rightTokenId) {
      return leftTokenId < rightTokenId ? -1 : 1;
    }

    return 0;
  });

  return ranked[0] ?? null;
}

export async function readMellowStrategyPositions(input: {
  walletAddress: string;
  chainId: number;
  walletTokens: WalletTokenRecord[];
  now?: Date;
}): Promise<ReadMellowStrategyPositionsResult> {
  const now = input.now ?? new Date();
  const strategyTokens = input.walletTokens.filter(isMellowStrategyToken);

  if (strategyTokens.length === 0) {
    return {
      rows: [],
      providerPartial: false,
      artifacts: { wrappers: [], priceAddresses: [] },
    };
  }

  try {
    const wrapperStates = (await Promise.all(
      strategyTokens.map(async (token) => {
        const wrapperAddress = normalizeAddress(asString(token.token_address));
        const balanceRaw = asString(token.balance);
        const strategyLabel = asString(token.name) ?? asString(token.symbol) ?? "Mellow strategy exposure";
        if (!wrapperAddress || !balanceRaw || !/^\d+$/.test(balanceRaw)) {
          return null;
        }

        try {
          const [token0AddressRaw, token1AddressRaw, previewMintResult, infoResult, poolAddressRaw] = await Promise.all([
            ethCall({ address: wrapperAddress, abi: wrapperStrategyAbi, functionName: "token0" }),
            ethCall({ address: wrapperAddress, abi: wrapperStrategyAbi, functionName: "token1" }),
            ethCall({
              address: wrapperAddress,
              abi: wrapperStrategyAbi,
              functionName: "previewMint",
              args: [BigInt(balanceRaw)],
            }),
            ethCall({ address: wrapperAddress, abi: wrapperStrategyAbi, functionName: "getInfo" }),
            ethCall({ address: wrapperAddress, abi: wrapperStrategyAbi, functionName: "pool" }),
          ]);

          const token0Address = normalizeAddress(String(token0AddressRaw));
          const token1Address = normalizeAddress(String(token1AddressRaw));
          const previewMint = previewMintResult as readonly [bigint, bigint];
          const poolAddress = normalizeAddress(String(poolAddressRaw));
          const infoEntries = (infoResult as Array<{
            tokenId?: bigint;
            tickSpacing?: number | bigint;
            tickLower?: number | bigint;
            tickUpper?: number | bigint;
            liquidity?: bigint;
          }>).map((entry) => ({
            tokenId: typeof entry.tokenId === "bigint" ? entry.tokenId.toString() : null,
            tickSpacing:
              typeof entry.tickSpacing === "bigint"
                ? Number(entry.tickSpacing)
                : typeof entry.tickSpacing === "number"
                  ? entry.tickSpacing
                  : null,
            tickLower:
              typeof entry.tickLower === "bigint"
                ? Number(entry.tickLower)
                : typeof entry.tickLower === "number"
                  ? entry.tickLower
                  : null,
            tickUpper:
              typeof entry.tickUpper === "bigint"
                ? Number(entry.tickUpper)
                : typeof entry.tickUpper === "number"
                  ? entry.tickUpper
                  : null,
            liquidity: typeof entry.liquidity === "bigint" ? entry.liquidity : BigInt(0),
          } satisfies MellowWrapperPositionInfo));
          const currentTick = poolAddress ? await readSlot0(poolAddress).then((result) => result.tick).catch(() => null) : null;
          const selectedInfo = selectPrimaryPositionInfo(infoEntries, currentTick);
          const tokenId = selectedInfo?.tokenId ?? null;
          const tickSpacing = selectedInfo?.tickSpacing ?? null;

          if (!token0Address || !token1Address) {
            return null;
          }

          return {
            wrapperAddress,
            strategyLabel,
            tokenId,
            feeTierLabel: formatFeeTierLabel(tickSpacing),
            shareBalanceRaw: BigInt(balanceRaw),
            token0Address,
            token1Address,
            token0AmountRaw: previewMint[0],
            token1AmountRaw: previewMint[1],
          } satisfies MellowWrapperState;
        } catch {
          return null;
        }
      }),
    )).filter((state): state is MellowWrapperState => state !== null);

    if (wrapperStates.length === 0) {
      return {
        rows: [],
        providerPartial: true,
        artifacts: null,
      };
    }

    const uniqueTokenAddresses = Array.from(
      new Set(wrapperStates.flatMap((state) => [state.token0Address, state.token1Address])),
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

    const rows = wrapperStates.map((state) => {
      const token0Metadata = tokenMetadataMap.get(state.token0Address) ?? { symbol: null, decimals: null };
      const token1Metadata = tokenMetadataMap.get(state.token1Address) ?? { symbol: null, decimals: null };
      const primaryTokenSymbol = token0Metadata.symbol;
      const secondaryTokenSymbol = token1Metadata.symbol;
      const primaryTokenAmount = normalizeTokenAmount(state.token0AmountRaw, token0Metadata.decimals);
      const secondaryTokenAmount = normalizeTokenAmount(state.token1AmountRaw, token1Metadata.decimals);
      const price0 = priceMap.get(state.token0Address) ?? null;
      const price1 = priceMap.get(state.token1Address) ?? null;
      const token0ValueUsd = primaryTokenAmount !== null && price0 ? primaryTokenAmount * price0.priceUsd : null;
      const token1ValueUsd = secondaryTokenAmount !== null && price1 ? secondaryTokenAmount * price1.priceUsd : null;
      const valueUsd = token0ValueUsd !== null && token1ValueUsd !== null
        ? token0ValueUsd + token1ValueUsd
        : null;
      const strategyLabel = state.strategyLabel;
      const reasonCodes = buildMetadataReasonCodes({
        family: "strategy_exposure",
        valueUsd,
        positionContractAddress: state.wrapperAddress,
        wrapperAddress: state.wrapperAddress,
        tokenId: null,
      });

      return {
        positionKey: buildProtocolPositionKey({
          chainId: input.chainId,
          protocol: "mellow",
          family: "strategy_exposure",
          walletAddress: input.walletAddress,
          wrapperAddress: state.wrapperAddress,
          positionContractAddress: state.wrapperAddress,
        }),
        chainId: input.chainId,
        walletAddress: input.walletAddress.toLowerCase(),
        family: "strategy_exposure",
        protocol: "mellow",
        label: buildProtocolLabel({
          family: "strategy_exposure",
          protocol: "mellow",
          primaryTokenSymbol,
          secondaryTokenSymbol,
          strategyLabel,
          governanceLabel: null,
        }),
        status: "active",
        coverageStatus: "share_level",
        coverageReasonCodes: reasonCodes,
        valueUsd,
        valueStatus: valueUsd !== null ? "estimated" : "unavailable",
        valueUpdatedAt: pickPriceTimestamp(price0?.pricedAt ?? null, price1?.pricedAt ?? null) ?? now.toISOString(),
        primaryTokenSymbol,
        secondaryTokenSymbol,
        primaryTokenAmount,
        secondaryTokenAmount,
        poolLabel:
          primaryTokenSymbol && secondaryTokenSymbol
            ? `${primaryTokenSymbol} / ${secondaryTokenSymbol}`
            : null,
        strategyLabel,
        governanceLabel: null,
        tokenId: state.tokenId,
        metadata: {
          protocolSurface: buildProtocolSurface("mellow", "strategy_exposure"),
          wrapperAddress: state.wrapperAddress,
          positionContractAddress: state.wrapperAddress,
          lockEndAt: null,
          feeTierLabel: state.feeTierLabel,
        },
      } satisfies OverviewProtocolPosition;
    });

    return {
      rows,
      providerPartial: priceResult === null || rows.some((row) => row.valueUsd === null),
      artifacts: {
        wrappers: wrapperStates.map((state, index) => ({
          wrapperAddress: state.wrapperAddress,
          strategyLabel: state.strategyLabel,
          tokenId: state.tokenId,
          feeTierLabel: state.feeTierLabel,
          shareBalanceRaw: state.shareBalanceRaw.toString(),
          token0Address: state.token0Address,
          token1Address: state.token1Address,
          token0AmountRaw: state.token0AmountRaw.toString(),
          token1AmountRaw: state.token1AmountRaw.toString(),
          valueUsd: rows[index]?.valueUsd ?? null,
        })),
        priceAddresses: uniqueTokenAddresses,
      },
    };
  } catch {
    return {
      rows: [],
      providerPartial: true,
      artifacts: null,
    };
  }
}