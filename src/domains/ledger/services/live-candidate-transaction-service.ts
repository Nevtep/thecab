import { BasescanWalletActivityProvider } from "@/domains/ledger/services/basescan-wallet-activity-provider";
import { RpcLogCandidateTransactionService } from "@/domains/ledger/services/rpc-log-candidate-transaction-service";
import { type WalletActivityDiscoveryProvider } from "@/domains/ledger/services/wallet-activity-discovery-provider";
import { logger } from "@/infrastructure/observability/logger";

export class LiveCandidateTransactionService {
  constructor(
    private readonly walletActivityProvider: WalletActivityDiscoveryProvider = new BasescanWalletActivityProvider(),
    private readonly rpcFallbackService = new RpcLogCandidateTransactionService()
  ) {}

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    if (this.walletActivityProvider.isConfigured()) {
      try {
        const activities = await this.walletActivityProvider.discover(input);
        return {
          txHashes: activities.map((activity) => activity.txHash),
          fixtureWallet: null,
          observationCorpus: [],
          providerKey: this.walletActivityProvider.providerKey
        };
      } catch (error) {
        logger.warn("Falling back to RPC log discovery after indexed wallet discovery failed.", {
          providerKey: this.walletActivityProvider.providerKey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    logger.info("Using RPC log fallback for live candidate discovery.", {
      providerKey: this.rpcFallbackService.providerKey,
      hasIndexedProvider: this.walletActivityProvider.isConfigured()
    });

    return this.rpcFallbackService.discover(input);
  }
}