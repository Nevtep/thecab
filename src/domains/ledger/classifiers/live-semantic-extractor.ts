import {
  decodeEventLog,
  isAddressEqual,
  parseAbiItem,
  zeroAddress,
  type Hex
} from "viem";

import { DISCARDED_REASON_CODES } from "@/domains/ledger/model/discarded-reasons";
import { AERODROME_POSITION_MANAGER_ADDRESSES } from "@/domains/protocols/aerodrome/contracts";
import {
  findSupportedMellowStrategy,
  type SupportedMellowStrategyConfig
} from "@/domains/protocols/mellow/contracts";
import {
  TokenMetadataService,
  type TokenMetadata
} from "@/domains/ledger/services/token-metadata-service";
import { type FixtureObservation, type FixtureSemantic } from "@/lib/fixture-loader";

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const ERC721_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);
const AERODROME_INCREASE_LIQUIDITY_EVENT = parseAbiItem(
  "event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
);
const AERODROME_DECREASE_LIQUIDITY_EVENT = parseAbiItem(
  "event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"
);
const AERODROME_COLLECT_EVENT = parseAbiItem(
  "event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)"
);

type DecodedWalletTransfer = {
  tokenAddress: string;
  from: string;
  to: string;
  value: bigint;
};

type DecodedNftTransfer = {
  from: string;
  to: string;
  tokenId: string;
};

type DecodedAerodromeEvent = {
  tokenId: string;
};

type DecodableLogPayload = Record<string, unknown> & {
  address: string;
  data: Hex;
  topics: Hex[];
};

type LiveSemanticState = {
  manualPositions: Map<
    string,
    {
      pool?: {
        address: string;
        protocolFamily: string;
        displayName: string;
        token0Address: string;
        token1Address: string;
        feeTier?: number;
      } | null;
      sourceContractAddress?: string | null;
    }
  >;
  mellowPositions: Map<
    string,
    {
      shareBalanceRaw: string | null;
      wrapperAddress?: string;
      stakingRewardsAddress?: string | null;
      pool?: {
        address: string;
        protocolFamily: string;
        displayName: string;
        token0Address: string;
        token1Address: string;
        feeTier?: number;
      } | null;
    }
  >;
};

type LiveSemanticInput = {
  walletAddress: string;
  observations: FixtureObservation[];
  state: LiveSemanticState;
};

const tokenMetadataService = new TokenMetadataService();

function toBigInt(value: unknown) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number") {
    return BigInt(value);
  }

  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }

  return 0n;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getTransactionPayload(observations: FixtureObservation[]) {
  return observations.find((observation) => observation.sourceType === "transaction")?.payloadJson ?? null;
}

function getLogPayloads(observations: FixtureObservation[]) {
  return observations
    .filter((observation) => observation.sourceType === "log")
    .map((observation) => observation.payloadJson)
    .filter(isRecord)
    .filter(
      (payload): payload is DecodableLogPayload =>
        typeof payload.address === "string" &&
        typeof payload.data === "string" &&
        Array.isArray(payload.topics) &&
        payload.topics.every((topic) => typeof topic === "string")
    );
}

function getTopics(topics: Hex[]) {
  return (topics.length > 0 ? topics : []) as [Hex, ...Hex[]] | [];
}

function decodeWalletTransfers(logPayloads: DecodableLogPayload[]) {
  const walletTransfers: DecodedWalletTransfer[] = [];
  const nftTransfers: DecodedNftTransfer[] = [];
  const increaseEvents: DecodedAerodromeEvent[] = [];
  const decreaseEvents: DecodedAerodromeEvent[] = [];
  const collectEvents: DecodedAerodromeEvent[] = [];

  for (const payload of logPayloads) {
    const address = payload.address.toLowerCase();

    if (AERODROME_POSITION_MANAGER_ADDRESSES.some((candidate) => candidate === address)) {
      try {
        const decodedNftTransfer = decodeEventLog({
          abi: [ERC721_TRANSFER_EVENT],
          data: payload.data,
          topics: getTopics(payload.topics)
        });
        nftTransfers.push({
          from: String(decodedNftTransfer.args.from).toLowerCase(),
          to: String(decodedNftTransfer.args.to).toLowerCase(),
          tokenId: String(decodedNftTransfer.args.tokenId)
        });
        continue;
      } catch {
        // Keep trying the remaining Aerodrome event types.
      }

      try {
        const decodedIncrease = decodeEventLog({
          abi: [AERODROME_INCREASE_LIQUIDITY_EVENT],
          data: payload.data,
          topics: getTopics(payload.topics)
        });
        increaseEvents.push({ tokenId: String(decodedIncrease.args.tokenId) });
        continue;
      } catch {
        // Keep trying.
      }

      try {
        const decodedDecrease = decodeEventLog({
          abi: [AERODROME_DECREASE_LIQUIDITY_EVENT],
          data: payload.data,
          topics: getTopics(payload.topics)
        });
        decreaseEvents.push({ tokenId: String(decodedDecrease.args.tokenId) });
        continue;
      } catch {
        // Keep trying.
      }

      try {
        const decodedCollect = decodeEventLog({
          abi: [AERODROME_COLLECT_EVENT],
          data: payload.data,
          topics: getTopics(payload.topics)
        });
        collectEvents.push({ tokenId: String(decodedCollect.args.tokenId) });
        continue;
      } catch {
        // Ignore unknown position-manager logs.
      }

      continue;
    }

    try {
      const decodedTransfer = decodeEventLog({
        abi: [ERC20_TRANSFER_EVENT],
        data: payload.data,
        topics: getTopics(payload.topics)
      });
      walletTransfers.push({
        tokenAddress: address,
        from: String(decodedTransfer.args.from).toLowerCase(),
        to: String(decodedTransfer.args.to).toLowerCase(),
        value: toBigInt(decodedTransfer.args.value)
      });
    } catch {
      // Ignore non-transfer logs.
    }
  }

  return {
    walletTransfers,
    nftTransfers,
    increaseEvents,
    decreaseEvents,
    collectEvents
  };
}

async function getTokenMetadata(tokenAddresses: string[]) {
  const uniqueTokenAddresses = [...new Set(tokenAddresses.map((address) => address.toLowerCase()))];
  const entries = await Promise.all(
    uniqueTokenAddresses.map(async (tokenAddress) => [tokenAddress, await tokenMetadataService.getMetadata(tokenAddress)] as const)
  );

  return new Map(entries);
}

function inferPoolAddress(input: {
  logPayloads: DecodableLogPayload[];
  excludedAddresses: string[];
  fallbackAddress?: string;
}) {
  const excluded = new Set(input.excludedAddresses.map((address) => address.toLowerCase()));
  const poolAddress = input.logPayloads
    .map((payload) => payload.address.toLowerCase())
    .find((address) => !excluded.has(address));

  return poolAddress ?? input.fallbackAddress ?? null;
}

function buildDisplayName(metadata: TokenMetadata[]) {
  if (metadata.length === 0) {
    return "Unknown Pool";
  }

  if (metadata.length === 1) {
    return metadata[0]?.symbol ?? metadata[0]?.tokenAddress ?? "Unknown Pool";
  }

  return `${metadata[0]?.symbol ?? metadata[0]?.tokenAddress} / ${metadata[1]?.symbol ?? metadata[1]?.tokenAddress}`;
}

async function buildAssetMovements(input: {
  walletAddress: string;
  transfers: DecodedWalletTransfer[];
  movementRole: "principal" | "reward" | "fee";
  excludedTokenAddresses?: string[];
}) {
  const excluded = new Set((input.excludedTokenAddresses ?? []).map((address) => address.toLowerCase()));
  const relevantTransfers = input.transfers.filter(
    (transfer) => !excluded.has(transfer.tokenAddress.toLowerCase())
  );
  const metadataByToken = await getTokenMetadata(relevantTransfers.map((transfer) => transfer.tokenAddress));

  return relevantTransfers.map((transfer) => {
    const metadata = metadataByToken.get(transfer.tokenAddress.toLowerCase());
    const direction = isAddressEqual(transfer.to as `0x${string}`, input.walletAddress as `0x${string}`)
      ? ("in" as const)
      : ("out" as const);

    return {
      tokenAddress: transfer.tokenAddress,
      symbol: metadata?.symbol ?? undefined,
      amountRaw: transfer.value.toString(),
      decimals: metadata?.decimals ?? 18,
      direction,
      movementRole: input.movementRole
    };
  });
}

async function buildPoolDescriptor(input: {
  logPayloads: DecodableLogPayload[];
  tokenAddresses: string[];
  protocolFamily: string;
  fallbackPool?: FixtureSemantic["pool"] | null;
  excludedAddresses: string[];
}) {
  const fallbackPool = input.fallbackPool ?? null;
  const tokenAddresses = [...new Set(input.tokenAddresses.map((address) => address.toLowerCase()))];

  if (tokenAddresses.length === 0 && fallbackPool) {
    return fallbackPool;
  }

  const metadata = await Promise.all(
    tokenAddresses.slice(0, 2).map((tokenAddress) => tokenMetadataService.getMetadata(tokenAddress))
  );
  const poolAddress = inferPoolAddress({
    logPayloads: input.logPayloads,
    excludedAddresses: [...input.excludedAddresses, ...tokenAddresses],
    fallbackAddress: fallbackPool?.address
  });

  if (!poolAddress) {
    return fallbackPool;
  }

  return {
    address: poolAddress,
    protocolFamily: input.protocolFamily,
    displayName: buildDisplayName(metadata),
    token0Address: tokenAddresses[0] ?? fallbackPool?.token0Address ?? zeroAddress,
    token1Address: tokenAddresses[1] ?? fallbackPool?.token1Address ?? zeroAddress,
    feeTier: fallbackPool?.feeTier
  };
}

function getTransactionTarget(observations: FixtureObservation[]) {
  const transactionPayload = getTransactionPayload(observations);
  if (!isRecord(transactionPayload) || typeof transactionPayload.to !== "string") {
    return null;
  }

  return transactionPayload.to.toLowerCase();
}

async function buildAerodromeSemantic(input: {
  walletAddress: string;
  logPayloads: DecodableLogPayload[];
  walletTransfers: DecodedWalletTransfer[];
  nftTransfers: DecodedNftTransfer[];
  increaseEvents: DecodedAerodromeEvent[];
  decreaseEvents: DecodedAerodromeEvent[];
  collectEvents: DecodedAerodromeEvent[];
  state: LiveSemanticState;
}) {
  const mintedTransfer = input.nftTransfers.find(
    (transfer) =>
      isAddressEqual(transfer.from as `0x${string}`, zeroAddress) &&
      isAddressEqual(transfer.to as `0x${string}`, input.walletAddress as `0x${string}`)
  );
  const burnedTransfer = input.nftTransfers.find(
    (transfer) =>
      isAddressEqual(transfer.to as `0x${string}`, zeroAddress) &&
      isAddressEqual(transfer.from as `0x${string}`, input.walletAddress as `0x${string}`)
  );
  const tokenId =
    mintedTransfer?.tokenId ??
    burnedTransfer?.tokenId ??
    input.increaseEvents[0]?.tokenId ??
    input.decreaseEvents[0]?.tokenId ??
    input.collectEvents[0]?.tokenId ??
    null;

  if (!tokenId) {
    return null;
  }

  const existingPosition = input.state.manualPositions.get(tokenId);
  const pool = await buildPoolDescriptor({
    logPayloads: input.logPayloads,
    tokenAddresses: input.walletTransfers.map((transfer) => transfer.tokenAddress),
    protocolFamily: "aerodrome_slipstream",
    fallbackPool: existingPosition?.pool ?? null,
    excludedAddresses: [...AERODROME_POSITION_MANAGER_ADDRESSES]
  });

  let action: FixtureSemantic["action"] = "increaseLiquidity";
  let explanation = `Extended manual Aerodrome position ${tokenId}.`;
  let movementRole: "principal" | "reward" | "fee" = "principal";
  let confidence = 0.95;

  if (mintedTransfer) {
    action = "mint";
    explanation = `Opened a manual Aerodrome position via newly minted tokenId ${tokenId}.`;
    confidence = 0.99;
  } else if (burnedTransfer || (input.decreaseEvents.length > 0 && input.collectEvents.length > 0)) {
    action = "closePosition";
    explanation = `Closed manual Aerodrome position ${tokenId}.`;
    confidence = 0.97;
  } else if (input.decreaseEvents.length > 0) {
    action = "decreaseLiquidity";
    explanation = `Reduced liquidity on manual Aerodrome position ${tokenId}.`;
    confidence = 0.97;
  } else if (input.collectEvents.length > 0) {
    action = "collect";
    explanation = `Collected fees from manual Aerodrome position ${tokenId}.`;
    movementRole = "fee";
    confidence = 0.96;
  }

  return {
    protocol: "aerodrome",
    action,
    tokenId,
    sourceContractAddress: AERODROME_POSITION_MANAGER_ADDRESSES[0],
    pool: pool ?? undefined,
    classificationConfidence: confidence,
    explanation,
    assetMovements: await buildAssetMovements({
      walletAddress: input.walletAddress,
      transfers: input.walletTransfers,
      movementRole
    })
  } satisfies FixtureSemantic;
}

async function buildMellowSemantic(input: {
  walletAddress: string;
  logPayloads: DecodableLogPayload[];
  walletTransfers: DecodedWalletTransfer[];
  transactionTarget: string | null;
  state: LiveSemanticState;
}) {
  const strategy = findSupportedMellowStrategy([
    input.transactionTarget,
    ...input.walletTransfers.map((transfer) => transfer.tokenAddress),
    ...input.logPayloads.map((payload) => payload.address)
  ]);

  if (!strategy) {
    return null;
  }

  const shareTransfers = input.walletTransfers.filter((transfer) =>
    isAddressEqual(transfer.tokenAddress as `0x${string}`, strategy.wrapperAddress as `0x${string}`)
  );
  const shareDelta = shareTransfers.reduce((sum, transfer) => {
    if (isAddressEqual(transfer.to as `0x${string}`, input.walletAddress as `0x${string}`)) {
      return sum + transfer.value;
    }

    if (isAddressEqual(transfer.from as `0x${string}`, input.walletAddress as `0x${string}`)) {
      return sum - transfer.value;
    }

    return sum;
  }, 0n);
  const identityReference = strategy.stakingRewardsAddress ?? strategy.wrapperAddress;
  const existingPosition = input.state.mellowPositions.get(identityReference);
  const previousShareBalance = toBigInt(existingPosition?.shareBalanceRaw);
  const nextShareBalance = previousShareBalance + shareDelta;
  const pool = await buildPoolDescriptor({
    logPayloads: input.logPayloads,
    tokenAddresses: input.walletTransfers
      .map((transfer) => transfer.tokenAddress)
      .filter((tokenAddress) => tokenAddress !== strategy.wrapperAddress),
    protocolFamily: "mellow_aerodrome",
    fallbackPool: existingPosition?.pool ?? null,
    excludedAddresses: [strategy.wrapperAddress, strategy.stakingRewardsAddress ?? ""]
  });

  if (shareDelta > 0n) {
    const lifecycleSequence = previousShareBalance > 0n ? 2 : 1;
    return {
      protocol: "mellow",
      action: "depositAndStake",
      sourceContractAddress: input.transactionTarget ?? strategy.wrapperAddress,
      wrapperAddress: strategy.wrapperAddress,
      stakingRewardsAddress: strategy.stakingRewardsAddress ?? undefined,
      shareBalanceRaw: nextShareBalance.toString(),
      lifecycleSequence,
      pool: pool ?? undefined,
      classificationConfidence: 0.93,
      explanation:
        lifecycleSequence > 1
          ? "Increased live Mellow exposure for the connected wallet."
          : "Opened live Mellow exposure for the connected wallet.",
      assetMovements: await buildAssetMovements({
        walletAddress: input.walletAddress,
        transfers: input.walletTransfers,
        movementRole: "principal"
      })
    } satisfies FixtureSemantic;
  }

  if (shareDelta < 0n) {
    return {
      protocol: "mellow",
      action: "unstakeAndWithdraw",
      sourceContractAddress: input.transactionTarget ?? strategy.wrapperAddress,
      wrapperAddress: strategy.wrapperAddress,
      stakingRewardsAddress: strategy.stakingRewardsAddress ?? undefined,
      shareBalanceRaw: nextShareBalance.toString(),
      pool: pool ?? undefined,
      classificationConfidence: 0.93,
      explanation: "Reduced live Mellow exposure for the connected wallet.",
      assetMovements: await buildAssetMovements({
        walletAddress: input.walletAddress,
        transfers: input.walletTransfers,
        movementRole: "principal"
      })
    } satisfies FixtureSemantic;
  }

  const rewardMovements = await buildAssetMovements({
    walletAddress: input.walletAddress,
    transfers: input.walletTransfers,
    movementRole: "reward",
    excludedTokenAddresses: [strategy.wrapperAddress]
  });

  if (rewardMovements.some((movement) => movement.direction === "in")) {
    return {
      protocol: "mellow",
      action: "claimReward",
      sourceContractAddress: input.transactionTarget ?? strategy.stakingRewardsAddress ?? strategy.wrapperAddress,
      wrapperAddress: strategy.wrapperAddress,
      stakingRewardsAddress: strategy.stakingRewardsAddress ?? undefined,
      shareBalanceRaw: previousShareBalance.toString(),
      pool: pool ?? undefined,
      classificationConfidence: 0.91,
      explanation: "Claimed Mellow rewards for the connected wallet.",
      assetMovements: rewardMovements
    } satisfies FixtureSemantic;
  }

  return null;
}

async function buildWalletSemantic(input: {
  walletAddress: string;
  walletTransfers: DecodedWalletTransfer[];
}) {
  if (input.walletTransfers.length === 0) {
    return null;
  }

  const inboundTransfers = input.walletTransfers.filter((transfer) =>
    isAddressEqual(transfer.to as `0x${string}`, input.walletAddress as `0x${string}`)
  );
  const outboundTransfers = input.walletTransfers.filter((transfer) =>
    isAddressEqual(transfer.from as `0x${string}`, input.walletAddress as `0x${string}`)
  );

  if (inboundTransfers.length > 0 && outboundTransfers.length === 0) {
    return {
      protocol: "wallet",
      action: "external_deposit",
      classificationConfidence: 0.95,
      explanation: "Detected an external token transfer into the connected wallet.",
      assetMovements: await buildAssetMovements({
        walletAddress: input.walletAddress,
        transfers: input.walletTransfers,
        movementRole: "principal"
      })
    } satisfies FixtureSemantic;
  }

  if (outboundTransfers.length > 0 && inboundTransfers.length === 0) {
    return {
      protocol: "wallet",
      action: "external_withdrawal",
      classificationConfidence: 0.95,
      explanation: "Detected an external token transfer out of the connected wallet.",
      assetMovements: await buildAssetMovements({
        walletAddress: input.walletAddress,
        transfers: input.walletTransfers,
        movementRole: "principal"
      })
    } satisfies FixtureSemantic;
  }

  return {
    protocol: "unsupported",
    action: "unsupported",
    discarded: {
      reasonType: "unsupported",
      reasonCode: DISCARDED_REASON_CODES.unsupportedAction,
      reasonMessage: "The live transaction mixed inbound and outbound wallet transfers in an unsupported pattern."
    }
  } satisfies FixtureSemantic;
}

export async function deriveLiveSemantic(input: LiveSemanticInput): Promise<FixtureSemantic | null> {
  const logPayloads = getLogPayloads(input.observations);
  const transactionTarget = getTransactionTarget(input.observations);
  const decoded = decodeWalletTransfers(logPayloads);

  const aerodromeSemantic = await buildAerodromeSemantic({
    walletAddress: input.walletAddress,
    logPayloads,
    walletTransfers: decoded.walletTransfers,
    nftTransfers: decoded.nftTransfers,
    increaseEvents: decoded.increaseEvents,
    decreaseEvents: decoded.decreaseEvents,
    collectEvents: decoded.collectEvents,
    state: input.state
  });

  if (aerodromeSemantic) {
    return aerodromeSemantic;
  }

  const mellowSemantic = await buildMellowSemantic({
    walletAddress: input.walletAddress,
    logPayloads,
    walletTransfers: decoded.walletTransfers,
    transactionTarget,
    state: input.state
  });

  if (mellowSemantic) {
    return mellowSemantic;
  }

  return buildWalletSemantic({
    walletAddress: input.walletAddress,
    walletTransfers: decoded.walletTransfers
  });
}