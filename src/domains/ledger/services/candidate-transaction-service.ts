import { parseAbiItem } from "viem";

import { AERODROME_POSITION_MANAGER_ADDRESSES } from "@/domains/protocols/aerodrome/contracts";
import { getBasePublicClient } from "@/infrastructure/chain/clients";
import {
  loadFixtureObservations,
  loadFixtureWalletByAddress,
  type FixtureObservation,
  type FixtureWalletMetadata
} from "@/lib/fixture-loader";

const ERC20_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const ERC721_TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
);
const DISCOVERY_CHUNK_SIZE = 250_000n;

export type CandidateDiscoveryResult = {
  txHashes: string[];
  fixtureWallet: FixtureWalletMetadata | null;
  observationCorpus: FixtureObservation[];
};

export class CandidateTransactionService {
  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<CandidateDiscoveryResult> {
    const fixtureWallet = await loadFixtureWalletByAddress(input.walletAddress);
    if (!fixtureWallet) {
      return {
        txHashes: await this.discoverLiveTxHashes(input),
        fixtureWallet: null,
        observationCorpus: []
      };
    }

    const observationCorpus = await loadFixtureObservations(fixtureWallet.rawObservationFile);
    const txHashes = fixtureWallet.txHashes.filter((txHash) => {
      const observation = observationCorpus.find((item) => item.txHash?.toLowerCase() === txHash.toLowerCase());
      if (!observation || observation.blockNumber == null) {
        return true;
      }

      const blockNumber = BigInt(observation.blockNumber);
      return blockNumber >= input.fromBlock && blockNumber <= input.toBlock;
    });

    return {
      txHashes,
      fixtureWallet,
      observationCorpus
    };
  }

  private async discoverLiveTxHashes(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const publicClient = getBasePublicClient();
    const txHashes = new Set<string>();
    const walletAddress = input.walletAddress.toLowerCase() as `0x${string}`;

    for (let start = input.fromBlock; start <= input.toBlock; start += DISCOVERY_CHUNK_SIZE + 1n) {
      const end = start + DISCOVERY_CHUNK_SIZE > input.toBlock ? input.toBlock : start + DISCOVERY_CHUNK_SIZE;

      const [incomingTransfers, outgoingTransfers, incomingNfts, outgoingNfts] = await Promise.all([
        publicClient.getLogs({
          event: ERC20_TRANSFER_EVENT,
          args: { to: walletAddress },
          fromBlock: start,
          toBlock: end
        }),
        publicClient.getLogs({
          event: ERC20_TRANSFER_EVENT,
          args: { from: walletAddress },
          fromBlock: start,
          toBlock: end
        }),
        publicClient.getLogs({
          address: [...AERODROME_POSITION_MANAGER_ADDRESSES],
          event: ERC721_TRANSFER_EVENT,
          args: { to: walletAddress },
          fromBlock: start,
          toBlock: end
        }),
        publicClient.getLogs({
          address: [...AERODROME_POSITION_MANAGER_ADDRESSES],
          event: ERC721_TRANSFER_EVENT,
          args: { from: walletAddress },
          fromBlock: start,
          toBlock: end
        })
      ]);

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
}