import {
  loadFixtureObservations,
  loadFixtureWalletByAddress,
  type FixtureObservation,
  type FixtureWalletMetadata
} from "@/lib/fixture-loader";

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
        txHashes: [],
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
}