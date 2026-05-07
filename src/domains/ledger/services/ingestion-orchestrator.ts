import { getBasePublicClient } from "@/infrastructure/chain/clients";

const DEFAULT_FINALITY_CONFIRMATIONS = 20n;
const MAX_INCREMENTAL_BLOCK_WINDOW = 9_999n;

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

  buildProcessingWindows(input: {
    fromBlock: bigint;
    toBlock: bigint;
    maxWindowSize?: bigint;
  }) {
    const windows: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
    const maxWindowSize = input.maxWindowSize ?? MAX_INCREMENTAL_BLOCK_WINDOW;

    for (let start = input.fromBlock; start <= input.toBlock; start += maxWindowSize + 1n) {
      const end = start + maxWindowSize > input.toBlock ? input.toBlock : start + maxWindowSize;
      windows.push({
        fromBlock: start,
        toBlock: end
      });
    }

    return windows;
  }
}

export { DEFAULT_FINALITY_CONFIRMATIONS, MAX_INCREMENTAL_BLOCK_WINDOW };