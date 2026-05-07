import { AlchemyWalletActivityProvider } from "@/domains/ledger/services/alchemy-wallet-activity-provider";
import { BasescanWalletActivityProvider } from "@/domains/ledger/services/basescan-wallet-activity-provider";
import { MoralisWalletActivityProvider } from "@/domains/ledger/services/moralis-wallet-activity-provider";
import { type WalletActivityDiscoveryProvider } from "@/domains/ledger/services/wallet-activity-discovery-provider";
import { logger } from "@/infrastructure/observability/logger";

const DEFAULT_PROVIDER_ORDER = ["moralis", "alchemy", "basescan"] as const;

export type ProviderChainDiscoveryResult = {
  txHashes: string[];
  providerKey: string;
  providerCursor: string | null;
};

export class ProviderChainOrchestrator {
  constructor(
    private readonly providersByAlias: Record<string, WalletActivityDiscoveryProvider> = {
      moralis: new MoralisWalletActivityProvider(),
      alchemy: new AlchemyWalletActivityProvider(),
      basescan: new BasescanWalletActivityProvider()
    }
  ) {}

  async discoverWithFallback(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    providerCursor?: string | null;
  }): Promise<ProviderChainDiscoveryResult | null> {
    const aliases = this.getProviderOrder();

    for (const alias of aliases) {
      const provider = this.providersByAlias[alias];
      if (!provider || !provider.isConfigured()) {
        continue;
      }

      try {
        const result = await provider.discover({
          walletAddress: input.walletAddress,
          fromBlock: input.fromBlock,
          toBlock: input.toBlock,
          providerCursor: input.providerCursor ?? null
        });

        return {
          txHashes: [...new Set(result.activities.map((activity) => activity.txHash.toLowerCase()))],
          providerKey: provider.providerKey,
          providerCursor: result.providerCursor ?? null
        };
      } catch (error) {
        logger.warn("Indexed wallet activity provider failed. Trying next provider.", {
          providerAlias: alias,
          providerKey: provider.providerKey,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return null;
  }

  private getProviderOrder() {
    const configured = process.env.DISCOVERY_PROVIDER_ORDER?.trim();
    if (!configured) {
      return [...DEFAULT_PROVIDER_ORDER];
    }

    const requested = configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);

    if (requested.length === 0) {
      return [...DEFAULT_PROVIDER_ORDER];
    }

    return requested;
  }
}
