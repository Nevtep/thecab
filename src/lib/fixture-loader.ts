import { readFile } from "node:fs/promises";
import path from "node:path";

type FixtureObservationSourceType = "block_header" | "transaction" | "receipt" | "log" | "trace_frame";

export type FixtureAssetMovement = {
  tokenAddress: string;
  symbol?: string;
  amountRaw: string;
  decimals: number;
  direction: "in" | "out" | "internal";
  movementRole: "principal" | "reward" | "fee" | "swap_leg" | "residual_change";
};

export type FixturePoolDescriptor = {
  address: string;
  protocolFamily: string;
  displayName: string;
  token0Address: string;
  token1Address: string;
  feeTier?: number;
};

export type FixtureSemantic = {
  protocol: "wallet" | "aerodrome" | "mellow" | "unsupported";
  action:
    | "external_deposit"
    | "external_withdrawal"
    | "mint"
    | "increaseLiquidity"
    | "decreaseLiquidity"
    | "collect"
    | "closePosition"
    | "depositAndStake"
    | "unstakeAndWithdraw"
    | "claimReward"
    | "swap"
    | "unsupported";
  pool?: FixturePoolDescriptor;
  sourceContractAddress?: string;
  tokenId?: string;
  tickLower?: number;
  tickUpper?: number;
  wrapperAddress?: string;
  stakingRewardsAddress?: string;
  shareBalanceRaw?: string;
  lifecycleSequence?: number;
  classificationConfidence?: number;
  explanation?: string;
  assetMovements?: FixtureAssetMovement[];
  residuals?: Array<{
    tokenAddress: string;
    symbol?: string;
    amountRaw: string;
    decimals: number;
    attributionConfidence: number;
    candidatePoolAddresses?: string[];
    reasonCode:
      | "idle_wallet_balance"
      | "rebalance_leftover"
      | "unallocated_close_proceeds"
      | "low_confidence_attribution";
  }>;
  discarded?: {
    reasonType: "unsupported" | "malicious" | "ambiguous" | "invalid";
    reasonCode: string;
    reasonMessage: string;
  };
};

export type FixtureObservation = {
  rawObservationId: string;
  sourceType: FixtureObservationSourceType;
  chainId: number;
  blockNumber: number | null;
  blockHash: string | null;
  txHash: string | null;
  logIndex?: number | null;
  tracePath?: string | null;
  contractAddress?: string | null;
  payloadJson: {
    semantic?: FixtureSemantic;
    [key: string]: unknown;
  };
  payloadHash?: string;
};

export type FixtureWalletMetadata = {
  scenarioId: string;
  walletAddress: string;
  chainId: number;
  rawObservationFile: string;
  txHashes: string[];
  expected?: {
    pools?: number;
    strategyTypes?: string[];
    residualHoldings?: number;
    discardedItems?: number;
  };
};

function fixturesRoot() {
  return path.join(process.cwd(), "tests", "fixtures");
}

async function safeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return null;
  }
}

export async function loadFixtureWalletByAddress(walletAddress: string) {
  const normalized = walletAddress.toLowerCase();
  const walletDir = path.join(fixturesRoot(), "wallets");
  const candidateFiles = ["us1-wallet.json", "us2-wallet.json", "us3-wallet.json"];

  for (const candidate of candidateFiles) {
    const metadata = await safeReadJson<FixtureWalletMetadata>(path.join(walletDir, candidate));
    if (metadata && metadata.walletAddress.toLowerCase() === normalized) {
      return metadata;
    }
  }

  return null;
}

export async function loadFixtureObservations(rawObservationFile: string) {
  const corpusPath = path.join(fixturesRoot(), "raw-observations", rawObservationFile);
  const corpus = await safeReadJson<FixtureObservation[]>(corpusPath);
  return corpus ?? [];
}

export function getSemanticFromObservation(observation: { payloadJson: unknown }) {
  if (
    typeof observation.payloadJson === "object" &&
    observation.payloadJson !== null &&
    "semantic" in observation.payloadJson
  ) {
    return (observation.payloadJson as { semantic?: FixtureSemantic }).semantic ?? null;
  }

  return null;
}