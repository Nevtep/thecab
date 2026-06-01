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

const ENGINE_V2_BASE_KNOWN_ADDRESSES = [
  {
    protocol: "aerodrome",
    label: "Protocol Grants / Flight School",
    address: "0x51E171d2FDe9b37BBBb624A53Ef54959422388E4",
    addressKind: "protocol-grants",
    sourceHint: "Aerodrome Token Transparency Framework Q2 2025 Protocol Grants / Flight School bucket",
  },
  {
    protocol: "aerodrome",
    label: "Public Goods Wallet",
    address: "0x834C0DA026d5F933C2c18Fa9F8Ba7f1f792fDa52",
    addressKind: "protocol-public-goods",
    sourceHint: "Aerodrome Token Transparency Framework Q2 2025 Public Goods wallet",
  },
  {
    protocol: "aerodrome",
    label: "Locked Funds / Buyback",
    address: "0x623CF63A1fA7068EBBDBa9F2EB262613EaB557a1",
    addressKind: "protocol-buyback",
    sourceHint: "Aerodrome Token Transparency Framework Q2 2025 locked funds delegated to Flight School",
  },
  {
    protocol: "aerodrome",
    label: "Velodrome Foundation Aerodrome Airdrop",
    address: "0x5b1892b546002Ff3dd508500575bD6Bf7a101431",
    addressKind: "protocol-airdrop",
    sourceHint: "Aerodrome Token Transparency Framework Q2 2025 foundation airdrop wallet",
  },
] as const;

export function protocolBootstrapSeedsForChain(chainId: number) {
  if (chainId !== 8453) return [];
  return ENGINE_V2_BASE_PROTOCOL_SEEDS;
}

export function protocolKnownAddressRowsForSeeds(chainId: number, seeds = protocolBootstrapSeedsForChain(chainId)) {
  const seedRows = seeds.map((seed) => ({
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

  if (chainId !== 8453) {
    return seedRows;
  }

  return [
    ...seedRows,
    ...ENGINE_V2_BASE_KNOWN_ADDRESSES.map((address) => ({
      chainId,
      address: address.address.toLowerCase(),
      protocol: address.protocol,
      addressKind: address.addressKind,
      label: address.label,
      sourceProvider: "engine-v2-bootstrap",
      sourceReference: address.sourceHint,
      confidence: "high",
      metadataJson: { sourceHint: address.sourceHint },
    })),
  ];
}

