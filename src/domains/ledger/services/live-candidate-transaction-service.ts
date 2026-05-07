import { ProviderChainOrchestrator } from "@/domains/ledger/services/provider-chain-orchestrator";
import { RpcLogCandidateTransactionService } from "@/domains/ledger/services/rpc-log-candidate-transaction-service";
import { logger } from "@/infrastructure/observability/logger";

export class LiveCandidateTransactionService {
  constructor(
    private readonly providerChainOrchestrator = new ProviderChainOrchestrator(),
    private readonly rpcFallbackService = new RpcLogCandidateTransactionService()
  ) {}

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
  }) {
    const indexedResult = await this.providerChainOrchestrator.discoverWithFallback(input);
    if (indexedResult) {
      return {
        txHashes: indexedResult.txHashes,
        fixtureWallet: null,
        observationCorpus: [],
        providerKey: indexedResult.providerKey,
        providerCursor: indexedResult.providerCursor
      };
    }

    logger.warn("Indexed wallet activity providers unavailable. Using RPC log emergency fallback.", {
      providerKey: this.rpcFallbackService.providerKey,
      degradedMode: true
    });

    return this.rpcFallbackService.discover(input);
  }
}