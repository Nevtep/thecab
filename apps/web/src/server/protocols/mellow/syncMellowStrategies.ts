import { and, eq } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { pools, protocolContracts, strategies } from "@/server/db/schema";
import { normalizeAddress } from "@/server/protocol-positions/protocolMetadata";

const MELLOW_SOURCE = "official_mellow_docs";
const MELLOW_SOURCE_REFERENCE = "Mellow Aerodrome CL strategies docs";

type OfficialMellowStrategy = {
  name: string;
  width: number;
  underlyingPoolAddress: string;
  wrapperAddress: string;
  stakingRewardsAddress: string;
};

const OFFICIAL_MELLOW_AERODROME_STRATEGIES: OfficialMellowStrategy[] = [
  {
    name: "CL200-WETH/BRETT",
    width: 6000,
    underlyingPoolAddress: "0x4e829f8a5213c42535ab84aa40bd4adcce9cba02",
    wrapperAddress: "0x940d74a151bfd827791352d4560cac3a5764a833",
    stakingRewardsAddress: "0xaafafd305b88d1b987692947e167c447ccbff8ad",
  },
  {
    name: "CL200-WETH/DEGEN",
    width: 6000,
    underlyingPoolAddress: "0xafb62448929664bfccb0aae22f232520e765ba88",
    wrapperAddress: "0xa53e7861527187d9887e64d86c2151316807ace1",
    stakingRewardsAddress: "0x79293082a2bb8c57a81fa101fe64331489ffdd60",
  },
  {
    name: "CL200-WETH/AERO",
    width: 6000,
    underlyingPoolAddress: "0x82321f3beb69f503380d6b233857d5c43562e2d0",
    wrapperAddress: "0x9b6d95c7cf8aff7d799b6dcc35fef76d8167a0dd",
    stakingRewardsAddress: "0xb24d945b9d35420aded2ab47ff66ef2492a1c947",
  },
  {
    name: "CL100-WETH/USDC",
    width: 4000,
    underlyingPoolAddress: "0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59",
    wrapperAddress: "0x731f2cdf517b9f8702cb4c3200bb2bd8ecd3c7a7",
    stakingRewardsAddress: "0xd4305877ab5dedfc939fa209812c828343a23f83",
  },
  {
    name: "CL100-WETH/USD+",
    width: 4000,
    underlyingPoolAddress: "0x4d69971ccd4a636c403a3c1b00c85e99bb9b5606",
    wrapperAddress: "0x2f4f2dee13ff6597fc57a0d6fd9496722103d4fa",
    stakingRewardsAddress: "0x5585d8cc99720f77706b4ae720791b7ad26c5eb8",
  },
  {
    name: "CL100-WETH/USDT",
    width: 4000,
    underlyingPoolAddress: "0x9785ef59e2b499fb741674ecf6faf912df7b3c1b",
    wrapperAddress: "0x9ec3d1204d2815cbf26a4a5f8448d5afc42c789b",
    stakingRewardsAddress: "0x919ae9b1a9370145585d7d6edc61cff0839e7a8a",
  },
  {
    name: "CL50-EURC/USDC",
    width: 1000,
    underlyingPoolAddress: "0xe846373c1a92b167b4e9cd5d8e4d6b1db9e90ec7",
    wrapperAddress: "0xe9f4eb4b4c884204a3383fc64481e157bba882aa",
    stakingRewardsAddress: "0xd9ef9874d58719e4f256d96edd2dce19f9c3d3d9",
  },
  {
    name: "CL1-WETH/wstETH",
    width: 1,
    underlyingPoolAddress: "0x861a2922be165a5bd41b1e482b49216b465e1b5f",
    wrapperAddress: "0x28d8d6c17ed96b4d15bcbac02040dcdd41678750",
    stakingRewardsAddress: "0x2a0881a1636d433cebb439e3c7efbf3cef29d700",
  },
  {
    name: "CL1-WETH/bsdETH",
    width: 1,
    underlyingPoolAddress: "0x2ae9df02539887d4ebce0230168a302d34784c82",
    wrapperAddress: "0x09636bd5dc37b364e430f4d9c60e0c214aa6ad43",
    stakingRewardsAddress: "0xcba8f910af1c50c9d075dde10f34fdc4f0233d85",
  },
  {
    name: "CL1-USDz/USDC",
    width: 1,
    underlyingPoolAddress: "0xde5ff829fef54d1bdec957d9538a306f0ead1368",
    wrapperAddress: "0x6e4b3093c38b4a422fa6f4617eab4fa93283a73d",
    stakingRewardsAddress: "0xf5d8609c202e84f665679c3625f6dc6b27b70799",
  },
  {
    name: "CL1-USDC/eUSD",
    width: 1,
    underlyingPoolAddress: "0x988702fe529a3461ec7fd09eea3f962856709fd9",
    wrapperAddress: "0xae8cde18e46a93b0b06a29e35cb61ded411c322e",
    stakingRewardsAddress: "0x8741d5e1b271546b899562d1690b3519f1dc60f5",
  },
  {
    name: "CL1-cbETH/WETH",
    width: 1,
    underlyingPoolAddress: "0x47ca96ea59c13f72745928887f84c9f52c3d7348",
    wrapperAddress: "0x53017a5b2c56583e184577578d55ab098b40323d",
    stakingRewardsAddress: "0x8bd5e3141a134d3d26b458293ad1c9d56d66fb8a",
  },
  {
    name: "CL1-ezETH/WETH",
    width: 1,
    underlyingPoolAddress: "0xdc7ead706795eda3feda08ad519d9452badf2c0d",
    wrapperAddress: "0x70a5e525c88ace896de311f7dd4c46ff62d2c8c2",
    stakingRewardsAddress: "0x0a64501684dd1df7e8c06456dbd324f971848914",
  },
  {
    name: "CL100-WETH/cbBTC",
    width: 4000,
    underlyingPoolAddress: "0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    wrapperAddress: "0xbdb39e6a52a4d91a96e79c7c2dcbd8915ce99c14",
    stakingRewardsAddress: "0xb17d90ff52077811304d24ba8ce969425815b163",
  },
  {
    name: "CL100-USDC/cbBTC",
    width: 4000,
    underlyingPoolAddress: "0x4e962bb3889bf030368f56810a9c96b83cb3e778",
    wrapperAddress: "0x62f607b2add31b32f090943bc28fcc0b4f9b0ce5",
    stakingRewardsAddress: "0xf1f6c37fc0d67d1965cac00559e665de5d67fbc3",
  },
];

function derivePoolLabelFromStrategyName(strategyName: string) {
  const [, pairSegment] = strategyName.split("-", 2);
  return pairSegment ? pairSegment.replace("/", " / ") : null;
}

function normalizePoolLabel(poolLabel: string | null | undefined) {
  return poolLabel?.replace(/\s*\/\s*/g, " / ").trim().toLowerCase() ?? null;
}

export async function syncMellowStrategies(input: {
  chainId: number;
}) {
  const db = getDb();
  const [strategyRows, poolRows] = await Promise.all([
    db
      .select({
        id: strategies.id,
        label: strategies.label,
        wrapperAddress: strategies.wrapperAddress,
        stakingRewardsAddress: strategies.stakingRewardsAddress,
        coverageStatus: strategies.coverageStatus,
        metadataJson: strategies.metadataJson,
      })
      .from(strategies)
      .where(eq(strategies.chainId, input.chainId)),
    db
      .select({
        id: pools.id,
        poolAddress: pools.poolAddress,
        label: pools.label,
      })
      .from(pools)
      .where(eq(pools.chainId, input.chainId)),
  ]);

  const poolIdByAddress = new Map(
    poolRows
      .map((row) => [normalizeAddress(row.poolAddress), row.id] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0])),
  );
  const poolIdByLabel = new Map(
    poolRows.map((row) => [normalizePoolLabel(row.label), row.id] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[0])),
  );
  const officialByWrapper = new Map(
    OFFICIAL_MELLOW_AERODROME_STRATEGIES.map((strategy) => [strategy.wrapperAddress, strategy] as const),
  );
  const officialByStakingRewards = new Map(
    OFFICIAL_MELLOW_AERODROME_STRATEGIES.map((strategy) => [strategy.stakingRewardsAddress, strategy] as const),
  );

  const syncTargets = strategyRows.map((row) => {
    const wrapperAddress = normalizeAddress(row.wrapperAddress);
    const stakingRewardsAddress = normalizeAddress(row.stakingRewardsAddress);
    const official =
      (wrapperAddress ? (officialByWrapper.get(wrapperAddress) ?? null) : null) ??
      (stakingRewardsAddress ? (officialByStakingRewards.get(stakingRewardsAddress) ?? null) : null);
    const storedPoolLabel = typeof row.metadataJson.poolLabel === "string" ? row.metadataJson.poolLabel : null;
    const derivedPoolLabel = official ? derivePoolLabelFromStrategyName(official.name) : storedPoolLabel;
    const normalizedStoredPoolLabel = normalizePoolLabel(storedPoolLabel);
    const normalizedDerivedPoolLabel = normalizePoolLabel(derivedPoolLabel);
    const primaryPoolId = official
      ? (poolIdByAddress.get(official.underlyingPoolAddress) ?? null)
      : (normalizedStoredPoolLabel ? (poolIdByLabel.get(normalizedStoredPoolLabel) ?? null) : null);

    return {
      row,
      wrapperAddress,
      official,
      stakingRewardsAddress: official?.stakingRewardsAddress ?? stakingRewardsAddress,
      poolLabel: derivedPoolLabel,
      primaryPoolId:
        primaryPoolId ??
        (normalizedDerivedPoolLabel ? (poolIdByLabel.get(normalizedDerivedPoolLabel) ?? null) : null),
    };
  });

  await Promise.all(syncTargets.flatMap((target) => {
    const strategyLabel = target.official?.name ?? target.row.label;
    const strategyMetadata = {
      ...(target.row.metadataJson ?? {}),
      poolLabel: target.poolLabel,
      width: target.official?.width ?? target.row.metadataJson.width ?? null,
      underlyingPoolAddress:
        target.official?.underlyingPoolAddress ??
        normalizeAddress(typeof target.row.metadataJson.underlyingPoolAddress === "string"
          ? target.row.metadataJson.underlyingPoolAddress
          : null),
      stakingRewardsAddress: target.stakingRewardsAddress,
      source: target.official ? MELLOW_SOURCE : "analysis_engine",
      sourceReference: target.official ? MELLOW_SOURCE_REFERENCE : "phase_pools",
      confidence: target.official ? "high" : (typeof target.row.metadataJson.confidence === "string"
        ? target.row.metadataJson.confidence
        : null),
    } satisfies Record<string, unknown>;

    return [
      target.wrapperAddress
        ? db
          .update(strategies)
          .set({
            label: strategyLabel,
            stakingRewardsAddress: target.stakingRewardsAddress,
            primaryPoolId: target.primaryPoolId,
            metadataJson: strategyMetadata,
            updatedAt: new Date(),
          })
          .where(and(eq(strategies.id, target.row.id), eq(strategies.chainId, input.chainId)))
        : null,
      target.wrapperAddress
        ? db
          .insert(protocolContracts)
          .values({
            chainId: input.chainId,
            address: target.wrapperAddress,
            protocol: "mellow",
            contractType: "mellow_wrapper",
            source: target.official ? MELLOW_SOURCE : "analysis_engine",
            sourceReference: target.official ? MELLOW_SOURCE_REFERENCE : "phase_pools",
            metadataJson: {
              strategyId: target.row.id,
              strategyLabel,
              poolLabel: target.poolLabel,
              primaryPoolId: target.primaryPoolId,
              underlyingPoolAddress: target.official?.underlyingPoolAddress ?? null,
              stakingRewardsAddress: target.stakingRewardsAddress,
              width: target.official?.width ?? null,
              confidence: target.official ? "high" : null,
            },
          })
          .onConflictDoUpdate({
            target: [protocolContracts.chainId, protocolContracts.address],
            set: {
              protocol: "mellow",
              contractType: "mellow_wrapper",
              source: target.official ? MELLOW_SOURCE : "analysis_engine",
              sourceReference: target.official ? MELLOW_SOURCE_REFERENCE : "phase_pools",
              metadataJson: {
                strategyId: target.row.id,
                strategyLabel,
                poolLabel: target.poolLabel,
                primaryPoolId: target.primaryPoolId,
                underlyingPoolAddress: target.official?.underlyingPoolAddress ?? null,
                stakingRewardsAddress: target.stakingRewardsAddress,
                width: target.official?.width ?? null,
                confidence: target.official ? "high" : null,
              },
              updatedAt: new Date(),
            },
          })
        : null,
      target.stakingRewardsAddress
        ? db
          .insert(protocolContracts)
          .values({
            chainId: input.chainId,
            address: target.stakingRewardsAddress,
            protocol: "mellow",
            contractType: "mellow_staking_rewards",
            source: target.official ? MELLOW_SOURCE : "analysis_engine",
            sourceReference: target.official ? MELLOW_SOURCE_REFERENCE : "phase_pools",
            metadataJson: {
              strategyId: target.row.id,
              strategyLabel,
              wrapperAddress: target.wrapperAddress,
              poolLabel: target.poolLabel,
              primaryPoolId: target.primaryPoolId,
              underlyingPoolAddress: target.official?.underlyingPoolAddress ?? null,
              width: target.official?.width ?? null,
              confidence: target.official ? "high" : null,
            },
          })
          .onConflictDoUpdate({
            target: [protocolContracts.chainId, protocolContracts.address],
            set: {
              protocol: "mellow",
              contractType: "mellow_staking_rewards",
              source: target.official ? MELLOW_SOURCE : "analysis_engine",
              sourceReference: target.official ? MELLOW_SOURCE_REFERENCE : "phase_pools",
              metadataJson: {
                strategyId: target.row.id,
                strategyLabel,
                wrapperAddress: target.wrapperAddress,
                poolLabel: target.poolLabel,
                primaryPoolId: target.primaryPoolId,
                underlyingPoolAddress: target.official?.underlyingPoolAddress ?? null,
                width: target.official?.width ?? null,
                confidence: target.official ? "high" : null,
              },
              updatedAt: new Date(),
            },
          })
        : null,
    ].filter(Boolean);
  }));

  return {
    strategyCount: strategyRows.length,
    officialStrategyCount: syncTargets.filter((target) => Boolean(target.official)).length,
    linkedPoolCount: syncTargets.filter((target) => Boolean(target.primaryPoolId)).length,
    stakingRewardsCount: syncTargets.filter((target) => Boolean(target.stakingRewardsAddress)).length,
  };
}