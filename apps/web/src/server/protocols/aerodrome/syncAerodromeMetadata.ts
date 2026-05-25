import { and, eq, inArray } from "drizzle-orm";
import { decodeFunctionResult, encodeFunctionData } from "viem";

import { getDb } from "@/server/db/client";
import { deposits, ledgerEvents, pools, protocolContracts } from "@/server/db/schema";
import { asString, normalizeAddress } from "@/server/protocol-positions/protocolMetadata";
import { alchemyRpc } from "@/server/providers/alchemy/rpc";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const routerDefaultFactoryAbi = [
  {
    type: "function",
    name: "defaultFactory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
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

const gaugePoolAbi = [
  {
    type: "function",
    name: "pool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugeStakingTokenAbi = [
  {
    type: "function",
    name: "stakingToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugeStakeAbi = [
  {
    type: "function",
    name: "stake",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugeLpTokenAbi = [
  {
    type: "function",
    name: "lpToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugeTokenAbi = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugeUpperTokenAbi = [
  {
    type: "function",
    name: "TOKEN",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

const gaugePoolProbes = [
  { abi: gaugePoolAbi, functionName: "pool", sourceReference: "gauge.pool()" },
  { abi: gaugeStakingTokenAbi, functionName: "stakingToken", sourceReference: "gauge.stakingToken()" },
  { abi: gaugeStakeAbi, functionName: "stake", sourceReference: "gauge.stake()" },
  { abi: gaugeLpTokenAbi, functionName: "lpToken", sourceReference: "gauge.lpToken()" },
  { abi: gaugeTokenAbi, functionName: "token", sourceReference: "gauge.token()" },
  { abi: gaugeUpperTokenAbi, functionName: "TOKEN", sourceReference: "gauge.TOKEN()" },
] as const;

type ContractDiscovery = {
  address: string;
  sourceReference: string;
  metadataJson: Record<string, unknown>;
};

type GaugeDiscovery = {
  gaugeAddress: string;
  poolAddress: string;
  sourceReference: string;
};

async function readContractAddress(input: {
  chainId: number;
  contractAddress: string;
  abi: readonly unknown[];
  functionName: string;
}) {
  const data = encodeFunctionData({
    abi: input.abi,
    functionName: input.functionName,
  } as Parameters<typeof encodeFunctionData>[0]);

  try {
    const result = await alchemyRpc<`0x${string}`>(
      "eth_call",
      [{ to: input.contractAddress, data }, "latest"],
      { chainId: input.chainId },
    );
    const decoded = decodeFunctionResult({
      abi: input.abi,
      functionName: input.functionName,
      data: result,
    } as Parameters<typeof decodeFunctionResult>[0]);

    const normalized = normalizeAddress(typeof decoded === "string" ? decoded : String(decoded));
    return normalized && normalized !== ZERO_ADDRESS ? normalized : null;
  } catch {
    return null;
  }
}

async function discoverFactoryContracts(input: {
  chainId: number;
  routerAddresses: string[];
  positionManagerAddresses: string[];
}) {
  const discoveries = new Map<string, ContractDiscovery>();

  for (const routerAddress of input.routerAddresses) {
    const factoryAddress = await readContractAddress({
      chainId: input.chainId,
      contractAddress: routerAddress,
      abi: routerDefaultFactoryAbi,
      functionName: "defaultFactory",
    });
    if (!factoryAddress) {
      continue;
    }

    discoveries.set(factoryAddress, {
      address: factoryAddress,
      sourceReference: "router.defaultFactory()",
      metadataJson: {
        routerAddresses: [routerAddress],
      },
    });
  }

  for (const positionManagerAddress of input.positionManagerAddresses) {
    const factoryAddress = await readContractAddress({
      chainId: input.chainId,
      contractAddress: positionManagerAddress,
      abi: positionManagerFactoryAbi,
      functionName: "factory",
    });
    if (!factoryAddress) {
      continue;
    }

    const existing = discoveries.get(factoryAddress);
    discoveries.set(factoryAddress, {
      address: factoryAddress,
      sourceReference: existing?.sourceReference ?? "positionManager.factory()",
      metadataJson: {
        routerAddresses: Array.from(
          new Set(
            Array.isArray(existing?.metadataJson.routerAddresses)
              ? existing?.metadataJson.routerAddresses.filter((value): value is string => typeof value === "string")
              : [],
          ),
        ),
        positionManagerAddresses: Array.from(
          new Set([
            ...(Array.isArray(existing?.metadataJson.positionManagerAddresses)
              ? existing?.metadataJson.positionManagerAddresses.filter((value): value is string => typeof value === "string")
              : []),
            positionManagerAddress,
          ]),
        ),
      },
    });
  }

  return Array.from(discoveries.values());
}

function buildGaugeCandidateAddresses(input: {
  walletAddress: string;
  excludedAddresses: Set<string>;
  ledgerRows: Array<{
    classification: string | null;
    metadataJson: Record<string, unknown>;
  }>;
}) {
  const candidates = new Set<string>();

  for (const row of input.ledgerRows) {
    const text = [
      row.classification,
      asString(row.metadataJson.category),
      asString(row.metadataJson.methodLabel),
      asString(row.metadataJson.summary),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const isGaugeLike =
      text.includes("aerodrome") ||
      text.includes("gauge") ||
      text.includes("stake") ||
      text.includes("unstake") ||
      text.includes("farm") ||
      text.includes("reward");

    if (!isGaugeLike) {
      continue;
    }

    for (const address of [
      normalizeAddress(asString(row.metadataJson.fromAddress)),
      normalizeAddress(asString(row.metadataJson.toAddress)),
    ]) {
      if (!address || address === input.walletAddress || input.excludedAddresses.has(address)) {
        continue;
      }

      candidates.add(address);
    }
  }

  return Array.from(candidates);
}

async function discoverGaugeContracts(input: {
  chainId: number;
  candidateAddresses: string[];
  poolAddresses: Set<string>;
}) {
  const discoveries: GaugeDiscovery[] = [];

  for (const candidateAddress of input.candidateAddresses) {
    for (const probe of gaugePoolProbes) {
      const poolAddress = await readContractAddress({
        chainId: input.chainId,
        contractAddress: candidateAddress,
        abi: probe.abi,
        functionName: probe.functionName,
      });

      if (!poolAddress || !input.poolAddresses.has(poolAddress)) {
        continue;
      }

      discoveries.push({
        gaugeAddress: candidateAddress,
        poolAddress,
        sourceReference: probe.sourceReference,
      });
      break;
    }
  }

  return discoveries;
}

export async function syncAerodromeMetadata(input: {
  chainId: number;
  walletAddress: string;
}) {
  const db = getDb();
  const walletAddress = input.walletAddress.toLowerCase();
  const [depositRows, routerRows, ledgerRows] = await Promise.all([
    db
      .select({
        poolId: deposits.poolId,
        positionManagerAddress: deposits.positionManagerAddress,
        metadataJson: deposits.metadataJson,
      })
      .from(deposits)
      .where(and(eq(deposits.chainId, input.chainId), eq(deposits.walletAddress, walletAddress))),
    db
      .select({
        address: protocolContracts.address,
      })
      .from(protocolContracts)
      .where(
        and(
          eq(protocolContracts.chainId, input.chainId),
          eq(protocolContracts.protocol, "aerodrome"),
          eq(protocolContracts.contractType, "router"),
        ),
      ),
    db
      .select({
        classification: ledgerEvents.classification,
        metadataJson: ledgerEvents.metadataJson,
      })
      .from(ledgerEvents)
      .where(and(eq(ledgerEvents.chainId, input.chainId), eq(ledgerEvents.walletAddress, walletAddress))),
  ]);

  const poolIds = depositRows
    .map((row) => row.poolId)
    .filter((poolId): poolId is string => Boolean(poolId));
  const poolRows = poolIds.length === 0
    ? []
    : await db
      .select({ id: pools.id, poolAddress: pools.poolAddress, label: pools.label, metadataJson: pools.metadataJson })
      .from(pools)
      .where(inArray(pools.id, poolIds));
  const poolById = new Map(poolRows.map((row) => [row.id, row] as const));
  const poolByAddress = new Map(
    poolRows.map((row) => [row.poolAddress.toLowerCase(), row] as const),
  );
  const positionManagerAddresses = Array.from(
    new Set(
      depositRows
        .map((row) => normalizeAddress(row.positionManagerAddress))
        .filter((address): address is string => Boolean(address)),
    ),
  );
  const routerAddresses = Array.from(
    new Set(
      routerRows
        .map((row) => normalizeAddress(row.address))
        .filter((address): address is string => Boolean(address)),
    ),
  );
  const discoveredFactories = await discoverFactoryContracts({
    chainId: input.chainId,
    routerAddresses,
    positionManagerAddresses,
  });
  const discoveredFactoryAddresses = new Set(discoveredFactories.map((item) => item.address));
  const poolAddresses = new Set(poolRows.map((row) => row.poolAddress.toLowerCase()));
  const gaugeCandidates = buildGaugeCandidateAddresses({
    walletAddress,
    excludedAddresses: new Set([
      ...poolAddresses,
      ...positionManagerAddresses,
      ...routerAddresses,
      ...Array.from(discoveredFactoryAddresses),
    ]),
    ledgerRows,
  });
  const discoveredGauges = await discoverGaugeContracts({
    chainId: input.chainId,
    candidateAddresses: gaugeCandidates,
    poolAddresses,
  });
  const gaugeByPoolAddress = new Map(discoveredGauges.map((item) => [item.poolAddress, item] as const));
  const primaryFactoryAddress = discoveredFactories[0]?.address ?? null;

  const upserts = depositRows.flatMap((row) => {
    const pool = row.poolId ? poolById.get(row.poolId) : null;
    const normalizedPoolAddress = pool?.poolAddress.toLowerCase() ?? null;
    const gaugeDiscovery = normalizedPoolAddress ? (gaugeByPoolAddress.get(normalizedPoolAddress) ?? null) : null;

    return [
      row.positionManagerAddress
        ? db
          .insert(protocolContracts)
          .values({
            chainId: input.chainId,
            address: row.positionManagerAddress.toLowerCase(),
            protocol: "aerodrome",
            contractType: "position_manager",
            source: "analysis_engine",
            sourceReference: "phase_pools",
            metadataJson: {
              walletAddress,
              poolId: row.poolId,
            },
          })
          .onConflictDoUpdate({
            target: [protocolContracts.chainId, protocolContracts.address],
            set: {
              protocol: "aerodrome",
              contractType: "position_manager",
              source: "analysis_engine",
              sourceReference: "phase_pools",
              metadataJson: {
                walletAddress,
                poolId: row.poolId,
              },
              updatedAt: new Date(),
            },
          })
        : null,
      pool
        ? db
          .insert(protocolContracts)
          .values({
            chainId: input.chainId,
            address: pool.poolAddress.toLowerCase(),
            protocol: "aerodrome",
            contractType: "pool",
            source: "discovered",
            sourceReference: "phase_pools.pool",
            metadataJson: {
              ...(pool.metadataJson ?? {}),
              label: pool.label,
              factoryAddress: primaryFactoryAddress,
              gaugeAddress: gaugeDiscovery?.gaugeAddress ?? null,
            },
          })
          .onConflictDoUpdate({
            target: [protocolContracts.chainId, protocolContracts.address],
            set: {
              protocol: "aerodrome",
              contractType: "pool",
              source: "discovered",
              sourceReference: "phase_pools.pool",
              metadataJson: {
                ...(pool.metadataJson ?? {}),
                label: pool.label,
                factoryAddress: primaryFactoryAddress,
                gaugeAddress: gaugeDiscovery?.gaugeAddress ?? null,
              },
              updatedAt: new Date(),
            },
          })
        : null,
    ].filter(Boolean);
  });

  const discoveryUpserts = [
    ...discoveredFactories.map((factory) =>
      db
        .insert(protocolContracts)
        .values({
          chainId: input.chainId,
          address: factory.address,
          protocol: "aerodrome",
          contractType: "factory",
          source: "discovered",
          sourceReference: factory.sourceReference,
          metadataJson: {
            walletAddress,
            ...factory.metadataJson,
          },
        })
        .onConflictDoUpdate({
          target: [protocolContracts.chainId, protocolContracts.address],
          set: {
            protocol: "aerodrome",
            contractType: "factory",
            source: "discovered",
            sourceReference: factory.sourceReference,
            metadataJson: {
              walletAddress,
              ...factory.metadataJson,
            },
            updatedAt: new Date(),
          },
        }),
    ),
    ...discoveredGauges.map((gauge) => {
      const pool = poolByAddress.get(gauge.poolAddress) ?? null;

      return db
        .insert(protocolContracts)
        .values({
          chainId: input.chainId,
          address: gauge.gaugeAddress,
          protocol: "aerodrome",
          contractType: "gauge",
          source: "discovered",
          sourceReference: gauge.sourceReference,
          metadataJson: {
            walletAddress,
            poolAddress: gauge.poolAddress,
            poolId: pool?.id ?? null,
            poolLabel: pool?.label ?? null,
          },
        })
        .onConflictDoUpdate({
          target: [protocolContracts.chainId, protocolContracts.address],
          set: {
            protocol: "aerodrome",
            contractType: "gauge",
            source: "discovered",
            sourceReference: gauge.sourceReference,
            metadataJson: {
              walletAddress,
              poolAddress: gauge.poolAddress,
              poolId: pool?.id ?? null,
              poolLabel: pool?.label ?? null,
            },
            updatedAt: new Date(),
          },
        });
    }),
  ];

  const poolMetadataUpdates = poolRows.map((pool) => {
    const gaugeDiscovery = gaugeByPoolAddress.get(pool.poolAddress.toLowerCase()) ?? null;
    if (!primaryFactoryAddress && !gaugeDiscovery) {
      return null;
    }

    return db
      .update(pools)
      .set({
        metadataJson: {
          ...(pool.metadataJson ?? {}),
          factoryAddress: primaryFactoryAddress,
          gaugeAddress: gaugeDiscovery?.gaugeAddress ?? null,
        },
        updatedAt: new Date(),
      })
      .where(and(eq(pools.id, pool.id), eq(pools.chainId, input.chainId)));
  }).filter(Boolean);

  await Promise.all([...upserts, ...discoveryUpserts, ...poolMetadataUpdates]);

  return {
    positionManagerCount: depositRows.filter((row) => Boolean(row.positionManagerAddress)).length,
    poolCount: poolRows.length,
    factoryCount: discoveredFactories.length,
    gaugeCount: discoveredGauges.length,
  };
}