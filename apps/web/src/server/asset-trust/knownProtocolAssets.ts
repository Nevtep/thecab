import type { AssetTrustKnownProtocolMatch } from "@/server/asset-trust/assetTrust.types";

const BASE_CHAIN_ID = 8453;

const KNOWN_PROTOCOL_ASSET_REFERENCES: AssetTrustKnownProtocolMatch[] = [
  {
    chainId: BASE_CHAIN_ID,
    tokenAddress: "0x940181a94a35a4569e4529a3cdfb74e38fd98631",
    protocol: "aerodrome",
    reasonCode: "knownAerodromeToken",
    source: "chain_bootstrap",
  },
];

type ProtocolContractCandidate = {
  chainId: number;
  address: string;
  protocol: string;
  contractType: string;
  metadataJson?: Record<string, unknown> | null;
};

function normalizeAddress(address: string | null | undefined) {
  return address?.toLowerCase() ?? null;
}

function inferProtocolMatchFromContract(
  contract: ProtocolContractCandidate,
): AssetTrustKnownProtocolMatch | null {
  const protocol = contract.protocol.toLowerCase();
  if (protocol !== "aerodrome" && protocol !== "mellow") {
    return null;
  }

  const tokenAddress = normalizeAddress(contract.address);
  if (!tokenAddress) {
    return null;
  }

  return {
    chainId: contract.chainId,
    tokenAddress,
    protocol,
    reasonCode: protocol === "aerodrome" ? "knownAerodromeToken" : "knownProtocolContract",
    source: protocol === "aerodrome" ? "aerodrome_metadata" : "mellow_metadata",
  };
}

export function resolveKnownProtocolAssetMatch(
  chainId: number,
  tokenAddress: string | null,
  protocolContracts: ProtocolContractCandidate[] = [],
) {
  const normalizedTokenAddress = normalizeAddress(tokenAddress);
  if (!normalizedTokenAddress) {
    return null;
  }

  const bootstrapMatch = KNOWN_PROTOCOL_ASSET_REFERENCES.find(
    (reference) =>
      reference.chainId === chainId && reference.tokenAddress === normalizedTokenAddress,
  );
  if (bootstrapMatch) {
    return bootstrapMatch;
  }

  for (const contract of protocolContracts) {
    if (contract.chainId !== chainId) {
      continue;
    }

    const match = inferProtocolMatchFromContract(contract);
    if (match?.tokenAddress === normalizedTokenAddress) {
      return match;
    }

    const metadataTokenAddresses = [
      contract.metadataJson?.tokenAddress,
      contract.metadataJson?.assetAddress,
      contract.metadataJson?.underlyingTokenAddress,
    ]
      .map((value) => (typeof value === "string" ? normalizeAddress(value) : null))
      .filter((value): value is string => Boolean(value));

    if (metadataTokenAddresses.includes(normalizedTokenAddress)) {
      return match ?? {
        chainId,
        tokenAddress: normalizedTokenAddress,
        protocol: contract.protocol.toLowerCase(),
        reasonCode: "knownProtocolContract",
        source: "protocol_contracts",
      };
    }
  }

  return null;
}
