import { getBasePublicClient } from "@/infrastructure/chain/clients";

const DEFAULT_FINALITY_CONFIRMATIONS = 20n;

export type CandidateDiscoveryContext = {
  walletAddress: string;
  fromBlock: bigint;
  toBlock: bigint;
  protocolAllowlists: Record<string, readonly string[]>;
};

export class IngestionOrchestrator {
  async resolveCheckpointBlock(finalityConfirmations = DEFAULT_FINALITY_CONFIRMATIONS) {
    const publicClient = getBasePublicClient();
    const latestBlock = await publicClient.getBlockNumber();

    return latestBlock > finalityConfirmations
      ? latestBlock - finalityConfirmations
      : 0n;
  }

  async buildCandidateDiscoveryContext(input: {
    walletAddress: string;
    fromBlock?: bigint | null;
    toBlock?: bigint | null;
  }): Promise<CandidateDiscoveryContext> {
    const checkpointBlock = input.toBlock ?? (await this.resolveCheckpointBlock());
    const fromBlock = input.fromBlock ?? 0n;

    if (fromBlock > checkpointBlock) {
      throw new Error("fromBlock cannot be greater than the resolved checkpoint block.");
    }

    return {
      walletAddress: input.walletAddress.toLowerCase(),
      fromBlock,
      toBlock: checkpointBlock,
      protocolAllowlists: {
        aerodrome: [],
        mellow: []
      }
    };
  }

  async discoverCandidateTransactions(_context: CandidateDiscoveryContext) {
    return [] as string[];
  }
}