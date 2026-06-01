import { eq, and, sql } from "drizzle-orm";

import {
  buildContractAbiRecord,
  type ContractSeed,
} from "@/server/analysis/decoded-history/abi-registry";
import { normalizeAddress } from "@/server/analysis/decoded-history/address";
import type { AbiRegistryEntry } from "@/server/analysis/decoded-history";
import {
  fetchVerifiedContractAbi,
  type FetchVerifiedContractAbiInput,
} from "@/server/analysis/decoded-history/explorer-abi-client";
import {
  contractAbis,
  contractAbiSelectors,
  engineV2ProtocolKnownAddresses,
} from "@/server/db/schema";

import { selectorEventRowsFromAbi } from "./selector-event-index";

export type EngineV2AbiRegistryDb = any;

export type AbiRegistryFetchResult =
  | { status: "hit"; entry: AbiRegistryEntry }
  | { status: "fetched"; entry: AbiRegistryEntry }
  | { status: "miss"; reason: string };

function rowToEntry(row: Record<string, unknown> | undefined): AbiRegistryEntry | null {
  if (!row || !Array.isArray(row.abiJson)) return null;
  const address = normalizeAddress(row.address);
  if (!address) return null;

  return {
    chainId: Number(row.chainId),
    address,
    label: String(row.contractName ?? row.address ?? "Contract"),
    protocol: String(row.protocol ?? "observed"),
    expectedKind: String(row.contractKind ?? "observed-contract") as AbiRegistryEntry["expectedKind"],
    fetchedAt: row.fetchedAt instanceof Date ? row.fetchedAt.toISOString() : new Date().toISOString(),
    sources: {
      basescanApi: String(row.sourceUrl ?? ""),
      basescanCode: row.sourceReference ? String(row.sourceReference) : `https://basescan.org/address/${address}#code`,
    },
    source: {
      contractName: typeof row.contractName === "string" ? row.contractName : null,
      compilerVersion: null,
      optimizationUsed: null,
      runs: null,
      constructorArguments: null,
      evmVersion: null,
      library: null,
      licenseType: null,
      proxy: row.isProxy === true,
      implementation: typeof row.implementationAddress === "string" ? row.implementationAddress : null,
      swarmSource: null,
    },
    abi: row.abiJson,
    warnings: [],
  };
}

export function createEngineV2AbiRegistryRepository(db: EngineV2AbiRegistryDb) {
  return {
    async getContractAbi(input: { chainId: number; address: string }) {
      const address = normalizeAddress(input.address);
      if (!address) return null;
      const row = await db.query.contractAbis.findFirst({
        where: and(eq(contractAbis.chainId, input.chainId), eq(contractAbis.address, address)),
      });

      return rowToEntry(row);
    },

    async putFetchedAbi(input: {
      chainId: number;
      seed: ContractSeed;
      source: Record<string, unknown>;
      sourceUrl: string;
      sourceProvider?: string;
    }) {
      const record = buildContractAbiRecord({
        chainId: input.chainId,
        seed: input.seed,
        source: input.source,
        apiUrl: input.sourceUrl,
      });
      const [row] = await db.insert(contractAbis).values({
        chainId: record.chainId,
        address: record.address,
        implementationAddress: record.source.implementation,
        contractName: record.source.contractName ?? record.label,
        protocol: record.protocol,
        contractKind: record.expectedKind,
        abiJson: record.abi ? [...record.abi] : [],
        sourceProvider: input.sourceProvider ?? "etherscan-v2",
        sourceUrl: record.sources.basescanApi,
        sourceReference: record.sources.basescanCode,
        isProxy: record.source.proxy,
        metadataJson: {
          sources: record.sources,
          source: record.source,
          warnings: record.warnings,
        },
      }).onConflictDoUpdate?.({
        target: [contractAbis.chainId, contractAbis.address, contractAbis.implementationAddress],
        set: {
          contractName: sql`excluded.contract_name`,
          protocol: sql`excluded.protocol`,
          contractKind: sql`excluded.contract_kind`,
          abiJson: sql`excluded.abi_json`,
          sourceProvider: sql`excluded.source_provider`,
          sourceUrl: sql`excluded.source_url`,
          sourceReference: sql`excluded.source_reference`,
          isProxy: sql`excluded.is_proxy`,
          metadataJson: sql`excluded.metadata_json`,
          updatedAt: new Date(),
        },
      }).returning() ?? [];

      if (row?.id && record.abi) {
        await db.delete(contractAbiSelectors).where(eq(contractAbiSelectors.contractAbiId, String(row.id)));
        const rows = selectorEventRowsFromAbi({
          contractAbiId: String(row.id),
          chainId: record.chainId,
          address: record.address,
          abi: record.abi,
        });
        if (rows.length > 0) {
          await db.insert(contractAbiSelectors).values(rows).onConflictDoNothing?.();
        }
      }

      return rowToEntry({
        ...row,
        chainId: record.chainId,
        address: record.address,
        contractName: record.source.contractName ?? record.label,
        protocol: record.protocol,
        contractKind: record.expectedKind,
        abiJson: record.abi ? [...record.abi] : [],
        sourceUrl: record.sources.basescanApi,
        sourceReference: record.sources.basescanCode,
        isProxy: record.source.proxy,
      });
    },

    async putKnownAddresses(rows: Array<typeof engineV2ProtocolKnownAddresses.$inferInsert>) {
      if (rows.length === 0) return;
      await db.insert(engineV2ProtocolKnownAddresses).values(rows).onConflictDoNothing?.();
    },
  };
}

export async function ensureAbiForSeed(input: FetchVerifiedContractAbiInput & {
  repository: {
    getContractAbi(input: { chainId: number; address: string }): Promise<AbiRegistryEntry | null>;
    putFetchedAbi(input: {
      chainId: number;
      seed: ContractSeed;
      source: Record<string, unknown>;
      sourceUrl: string;
      sourceProvider?: string;
    }): Promise<AbiRegistryEntry | null>;
  };
}): Promise<AbiRegistryFetchResult> {
  const existing = await input.repository.getContractAbi({
    chainId: input.chainId,
    address: String(input.seed.address),
  });
  if (existing) return { status: "hit", entry: existing };

  try {
    const record = await fetchVerifiedContractAbi(input);
    const entry = await input.repository.putFetchedAbi({
      chainId: input.chainId,
      seed: input.seed,
      source: {
        ABI: JSON.stringify(record.abi ?? []),
        ContractName: record.source.contractName ?? record.label,
        Proxy: record.source.proxy ? "1" : "0",
        Implementation: record.source.implementation,
      },
      sourceUrl: record.sources.basescanApi,
      sourceProvider: "etherscan-v2",
    });
    return entry ? { status: "fetched", entry } : { status: "miss", reason: "abi_not_persisted" };
  } catch (error) {
    return { status: "miss", reason: error instanceof Error ? error.message : "abi_fetch_failed" };
  }
}
