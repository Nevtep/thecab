import { type ReconstructionRunMode } from "@/domains/ledger/model/reconstruction-run";
import { LiveCandidateTransactionService } from "@/domains/ledger/services/live-candidate-transaction-service";
import { ReplayCandidateTransactionService } from "@/domains/ledger/services/replay-candidate-transaction-service";
import { type FixtureObservation, type FixtureWalletMetadata } from "@/lib/fixture-loader";

export type CandidateDiscoveryResult = {
  txHashes: string[];
  fixtureWallet: FixtureWalletMetadata | null;
  observationCorpus: FixtureObservation[];
};

export class CandidateTransactionService {
  private readonly liveCandidateTransactionService = new LiveCandidateTransactionService();
  private readonly replayCandidateTransactionService = new ReplayCandidateTransactionService();

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    mode: ReconstructionRunMode;
  }): Promise<CandidateDiscoveryResult> {
    if (input.mode === "replay") {
      return this.replayCandidateTransactionService.discover(input);
    }

    return this.liveCandidateTransactionService.discover(input);
  }
}