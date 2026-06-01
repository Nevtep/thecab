import type { Abi, AbiFunction } from "viem";

import { normalizeAddress } from "./address";
import type {
  AbiRegistryEntry,
  AbiRegistryRepository,
  Address,
  ContractAbiRecord,
  ContractAbiSourceMetadata,
  ContractKind,
} from "./types";

export type ContractSeed = {
  protocol: string;
  label: string;
  address: Address | string;
  expectedKind: ContractKind;
  sourceHint?: string | null;
};

export type ExplorerContractSource = Record<string, unknown>;

export class InMemoryAbiRegistryRepository implements AbiRegistryRepository {
  private readonly records = new Map<string, AbiRegistryEntry>();

  constructor(records: ContractAbiRecord[] = []) {
    for (const record of records) {
      void this.putContractAbi(record);
    }
  }

  async getContractAbi(input: { chainId: number; address: Address }) {
    return this.records.get(keyForContract(input.chainId, input.address)) ?? null;
  }

  async putContractAbi(record: ContractAbiRecord) {
    if (!Array.isArray(record.abi)) return;
    this.records.set(keyForContract(record.chainId, record.address), {
      ...record,
      abi: record.abi,
    });
  }

  toMap() {
    return new Map([...this.records.entries()].map(([, value]) => [value.address, value]));
  }
}

export function keyForContract(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

export function parseContractAbi(rawAbi: unknown): Abi | null {
  if (typeof rawAbi !== "string" || rawAbi === "Contract source code not verified") {
    return null;
  }
  try {
    const abi = JSON.parse(rawAbi) as unknown;
    return Array.isArray(abi) ? abi as Abi : null;
  } catch {
    return null;
  }
}

export function sourceMetadata(source: ExplorerContractSource): ContractAbiSourceMetadata {
  return {
    contractName: asString(source.ContractName),
    compilerVersion: asString(source.CompilerVersion),
    optimizationUsed: asString(source.OptimizationUsed),
    runs: asString(source.Runs),
    constructorArguments: asString(source.ConstructorArguments),
    evmVersion: asString(source.EVMVersion),
    library: asString(source.Library),
    licenseType: asString(source.LicenseType),
    proxy: source.Proxy === "1",
    implementation: asString(source.Implementation),
    swarmSource: asString(source.SwarmSource),
  };
}

export function inferContractKind(input: {
  seedKind?: ContractKind | null;
  contractName?: string | null;
}): ContractKind {
  const name = input.contractName ?? "";
  if (name === "LpWrapper") return "strategy-wrapper";
  if (name === "CLGauge" || name === "Gauge") return "gauge";
  if (name === "Pool") return "pool";
  if (name === "NonfungiblePositionManager") return "position-manager";
  if (name === "UniversalRouter" || name === "Router") return "router";
  if (name === "Voter") return "governance-voter";
  if (name === "VotingEscrow") return "governance-lock";
  if (name === "RewardsDistributor") return "governance-rebase";
  return input.seedKind ?? "observed-contract";
}

export function registryKind(entry: AbiRegistryEntry | null): ContractKind | null {
  if (!entry) return null;
  return inferContractKind({
    seedKind: entry.expectedKind,
    contractName: entry.source?.contractName,
  });
}

export function buildContractAbiRecord(input: {
  chainId: number;
  seed: ContractSeed;
  source: ExplorerContractSource;
  fetchedAt?: string;
  apiUrl: string;
}): ContractAbiRecord {
  const address = normalizeAddress(input.seed.address);
  if (!address) {
    throw new Error(`Invalid contract address: ${input.seed.address}`);
  }
  const metadata = sourceMetadata(input.source);
  const abi = parseContractAbi(input.source.ABI);
  return {
    chainId: input.chainId,
    address,
    label: input.seed.label,
    protocol: input.seed.protocol,
    expectedKind: inferContractKind({
      seedKind: input.seed.expectedKind,
      contractName: metadata.contractName,
    }),
    fetchedAt: input.fetchedAt ?? new Date().toISOString(),
    sources: {
      basescanApi: input.apiUrl,
      basescanCode: `https://basescan.org/address/${address}#code`,
      sourceHint: input.seed.sourceHint,
    },
    source: metadata,
    abi,
    warnings: abi ? [] : ["ABI missing or source not verified on explorer"],
  };
}

export function buildRegistryMap(records: ContractAbiRecord[]) {
  const registry = new Map<Address, AbiRegistryEntry>();
  for (const record of records) {
    if (Array.isArray(record.abi)) {
      registry.set(record.address, {
        ...record,
        abi: record.abi,
      });
    }
  }
  return registry;
}

export function abiFunctions(entry: AbiRegistryEntry | null): AbiFunction[] {
  return (entry?.abi ?? []).filter((item): item is AbiFunction => {
    if (!item || typeof item !== "object") return false;
    return "type" in item && (item as { type?: unknown }).type === "function";
  });
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}
