import { ProviderChainOrchestrator } from "@/domains/ledger/services/provider-chain-orchestrator";
import { type WalletActivityDiscoveryProvider } from "@/domains/ledger/services/wallet-activity-discovery-provider";

vi.mock("@/infrastructure/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    priceCacheMiss: vi.fn(),
    pricingCoveragePartial: vi.fn()
  }
}));

type ProviderFactoryInput = {
  key: string;
  configured: boolean;
  discoverResult?: {
    txHashes: string[];
    providerCursor: string | null;
  };
  throws?: boolean;
};

function buildProvider(input: ProviderFactoryInput): WalletActivityDiscoveryProvider {
  return {
    providerKey: input.key,
    isConfigured: () => input.configured,
    discover: async () => {
      if (input.throws) {
        throw new Error(`Provider ${input.key} failed`);
      }

      return {
        activities: (input.discoverResult?.txHashes ?? []).map((txHash, index) => ({
          txHash,
          blockNumber: BigInt(index + 1),
          transactionIndex: index,
          sourceKind: "native",
          timestamp: null
        })),
        providerCursor: input.discoverResult?.providerCursor ?? null
      };
    }
  };
}

describe("provider chain orchestrator", () => {
  const originalProviderOrder = process.env.DISCOVERY_PROVIDER_ORDER;

  afterEach(() => {
    process.env.DISCOVERY_PROVIDER_ORDER = originalProviderOrder;
  });

  it("uses provider order and returns first successful provider result", async () => {
    process.env.DISCOVERY_PROVIDER_ORDER = "moralis,alchemy,basescan";

    const orchestrator = new ProviderChainOrchestrator({
      moralis: buildProvider({ key: "moralis_v2", configured: true, throws: true }),
      alchemy: buildProvider({
        key: "alchemy_v2",
        configured: true,
        discoverResult: {
          txHashes: ["0xaaa", "0xbbb"],
          providerCursor: "cursor_1"
        }
      }),
      basescan: buildProvider({
        key: "basescan_v2",
        configured: true,
        discoverResult: {
          txHashes: ["0xccc"],
          providerCursor: null
        }
      })
    });

    const result = await orchestrator.discoverWithFallback({
      walletAddress: "0xabc",
      fromBlock: 0n,
      toBlock: 100n,
      providerCursor: null
    });

    expect(result).toEqual({
      txHashes: ["0xaaa", "0xbbb"],
      providerKey: "alchemy_v2",
      providerCursor: "cursor_1"
    });
  });

  it("returns null when no configured provider succeeds", async () => {
    process.env.DISCOVERY_PROVIDER_ORDER = "moralis,alchemy,basescan";

    const orchestrator = new ProviderChainOrchestrator({
      moralis: buildProvider({ key: "moralis_v2", configured: false }),
      alchemy: buildProvider({ key: "alchemy_v2", configured: true, throws: true }),
      basescan: buildProvider({ key: "basescan_v2", configured: true, throws: true })
    });

    const result = await orchestrator.discoverWithFallback({
      walletAddress: "0xabc",
      fromBlock: 0n,
      toBlock: 100n,
      providerCursor: null
    });

    expect(result).toBeNull();
  });
});
