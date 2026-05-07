import { parseAbiItem } from "viem";

import { AERODROME_POSITION_MANAGER_ADDRESSES } from "@/domains/protocols/aerodrome/contracts";
import { MAX_INCREMENTAL_BLOCK_WINDOW } from "@/domains/ledger/services/ingestion-orchestrator";
import {
  createBasePublicClient,
  getBasePublicClient,
  getBasePublicRpcUrls
} from "@/infrastructure/chain/clients";
import { logger } from "@/infrastructure/observability/logger";

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const ERC721_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);
const DISCOVERY_CHUNK_SIZE = MAX_INCREMENTAL_BLOCK_WINDOW;
const DISCOVERY_LOG_CHUNK_SIZE = 9_999n;
const DISCOVERY_UNSUPPORTED_RPC_PATTERNS = ["publicnode.com"];

type BasePublicClient = ReturnType<typeof getBasePublicClient>;
type GetLogsRequest = Parameters<BasePublicClient["getLogs"]>[0];
type GetLogsResponse = Awaited<ReturnType<BasePublicClient["getLogs"]>>;

export class RpcLogCandidateTransactionService {
  readonly providerKey = "rpc_logs";

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    return {
      txHashes: await this.discoverLiveTxHashes(input),
      fixtureWallet: null,
      observationCorpus: [],
      providerKey: this.providerKey
    };
  }

  private async discoverLiveTxHashes(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const discoveryLogsClient = this.getCandidateDiscoveryClient();
    const txHashes = new Set<string>();
    const walletAddress = input.walletAddress.toLowerCase() as `0x${string}`;

    for (let start = input.fromBlock; start <= input.toBlock; start += DISCOVERY_CHUNK_SIZE + 1n) {
      const end = start + DISCOVERY_CHUNK_SIZE > input.toBlock ? input.toBlock : start + DISCOVERY_CHUNK_SIZE;

      const incomingTransfers = await this.collectLogsAcrossWindows(
        discoveryLogsClient,
        {
          event: ERC20_TRANSFER_EVENT,
          args: { to: walletAddress }
        },
        {
          fromBlock: start,
          toBlock: end,
          maxWindowSize: DISCOVERY_LOG_CHUNK_SIZE
        }
      );
      const outgoingTransfers = await this.collectLogsAcrossWindows(
        discoveryLogsClient,
        {
          event: ERC20_TRANSFER_EVENT,
          args: { from: walletAddress }
        },
        {
          fromBlock: start,
          toBlock: end,
          maxWindowSize: DISCOVERY_LOG_CHUNK_SIZE
        }
      );
      const incomingNfts = await this.collectLogsAcrossWindows(
        discoveryLogsClient,
        {
          address: [...AERODROME_POSITION_MANAGER_ADDRESSES],
          event: ERC721_TRANSFER_EVENT,
          args: { to: walletAddress }
        },
        {
          fromBlock: start,
          toBlock: end,
          maxWindowSize: DISCOVERY_LOG_CHUNK_SIZE
        }
      );
      const outgoingNfts = await this.collectLogsAcrossWindows(
        discoveryLogsClient,
        {
          address: [...AERODROME_POSITION_MANAGER_ADDRESSES],
          event: ERC721_TRANSFER_EVENT,
          args: { from: walletAddress }
        },
        {
          fromBlock: start,
          toBlock: end,
          maxWindowSize: DISCOVERY_LOG_CHUNK_SIZE
        }
      );

      for (const log of [
        ...incomingTransfers,
        ...outgoingTransfers,
        ...incomingNfts,
        ...outgoingNfts
      ]) {
        if (log.transactionHash) {
          txHashes.add(log.transactionHash.toLowerCase());
        }
      }
    }

    return [...txHashes].sort();
  }

  private getCandidateDiscoveryClient() {
    const filteredRpcUrls = getBasePublicRpcUrls().filter(
      (rpcUrl) => !DISCOVERY_UNSUPPORTED_RPC_PATTERNS.some((pattern) => rpcUrl.includes(pattern))
    );

    if (filteredRpcUrls.length === 0) {
      return getBasePublicClient();
    }

    return createBasePublicClient(filteredRpcUrls);
  }

  private async collectLogsAcrossWindows(
    publicClient: BasePublicClient,
    request: Omit<GetLogsRequest, "fromBlock" | "toBlock">,
    input: {
      fromBlock: bigint;
      toBlock: bigint;
      maxWindowSize?: bigint;
    }
  ) {
    const logs: GetLogsResponse = [] as GetLogsResponse;
    const maxWindowSize = input.maxWindowSize ?? DISCOVERY_CHUNK_SIZE;

    for (let start = input.fromBlock; start <= input.toBlock; start += maxWindowSize + 1n) {
      const end = start + maxWindowSize > input.toBlock ? input.toBlock : start + maxWindowSize;
      logs.push(
        ...(await this.getLogsWithAdaptiveRange(publicClient, request, start, end))
      );
    }

    return logs;
  }

  private async getLogsWithAdaptiveRange(
    publicClient: BasePublicClient,
    request: Omit<GetLogsRequest, "fromBlock" | "toBlock">,
    fromBlock: bigint,
    toBlock: bigint
  ): Promise<GetLogsResponse> {
    try {
      return await publicClient.getLogs({
        ...request,
        fromBlock,
        toBlock
      });
    } catch (error) {
      if (!this.shouldSplitRange(error, fromBlock, toBlock)) {
        throw error;
      }

      const midpoint = fromBlock + ((toBlock - fromBlock) / 2n);
      logger.warn("Splitting live discovery getLogs range after RPC rejection.", {
        fromBlock: fromBlock.toString(),
        toBlock: toBlock.toString(),
        error: error instanceof Error ? error.message : String(error)
      });

      const left = await this.getLogsWithAdaptiveRange(publicClient, request, fromBlock, midpoint);
      const right = await this.getLogsWithAdaptiveRange(publicClient, request, midpoint + 1n, toBlock);
      return [...left, ...right] as GetLogsResponse;
    }
  }

  private shouldSplitRange(error: unknown, fromBlock: bigint, toBlock: bigint) {
    if (fromBlock >= toBlock) {
      return false;
    }

    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    return [
      "too many requests",
      "rate limit",
      "eth_getlogs is limited",
      "maximum block range",
      "limited to a",
      "all rpcs are unreachable"
    ].some((fragment) => message.includes(fragment));
  }
}