import type { ContractSeed } from "@/server/analysis/decoded-history/abi-registry";

export const ENGINE_V2_BASE_PROTOCOL_SEEDS: ContractSeed[] = [
  {
    protocol: "aerodrome",
    label: "VotingEscrow",
    address: "0xebf418fe2512e7e6bd9b87a8f0f294acdc67e6b4",
    expectedKind: "governance-lock",
    sourceHint: "Aerodrome veAERO VotingEscrow on Base",
  },
  {
    protocol: "aerodrome",
    label: "Voter",
    address: "0x16613524e02ad97edfef371bc883f2f5d6c480a5",
    expectedKind: "governance-voter",
    sourceHint: "Aerodrome Voter on Base",
  },
  {
    protocol: "aerodrome",
    label: "RewardsDistributor",
    address: "0x227f65131a261548b057215bb1d5ab2997964c7d",
    expectedKind: "governance-rebase",
    sourceHint: "Aerodrome RewardsDistributor on Base",
  },
  {
    protocol: "aerodrome",
    label: "Slipstream Nonfungible Position Manager",
    address: "0x827922686190790b37229fd06084350e74485b72",
    expectedKind: "position-manager",
    sourceHint: "Aerodrome Slipstream CL position manager on Base",
  },
];

export function protocolBootstrapSeedsForChain(chainId: number) {
  if (chainId !== 8453) return [];
  return ENGINE_V2_BASE_PROTOCOL_SEEDS;
}

export function protocolKnownAddressRowsForSeeds(chainId: number, seeds = protocolBootstrapSeedsForChain(chainId)) {
  return seeds.map((seed) => ({
    chainId,
    address: String(seed.address).toLowerCase(),
    protocol: seed.protocol,
    addressKind: seed.expectedKind,
    label: seed.label,
    sourceProvider: "engine-v2-bootstrap",
    sourceReference: seed.sourceHint ?? null,
    confidence: "high",
    metadataJson: { sourceHint: seed.sourceHint ?? null },
  }));
}

