import { LiveCandidateTransactionService } from "@/domains/ledger/services/live-candidate-transaction-service";
import { RpcLogCandidateTransactionService } from "@/domains/ledger/services/rpc-log-candidate-transaction-service";
import {
  createBasePublicClient,
  getBasePublicRpcUrls
} from "@/infrastructure/chain/clients";

vi.mock("@/infrastructure/chain/clients", () => ({
  createBasePublicClient: vi.fn(),
  getBasePublicRpcUrls: vi.fn()
}));

vi.mock("@/infrastructure/observability/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    priceCacheMiss: vi.fn(),
    pricingCoveragePartial: vi.fn()
  }
}));

describe("live candidate transaction service", () => {
  beforeEach(() => {
    vi.mocked(getBasePublicRpcUrls).mockReturnValue([
      "https://base-mainnet.infura.io/v3/example",
      "https://base-rpc.publicnode.com"
    ]);
  });

  it("splits provider-limited log ranges and deduplicates transaction hashes", async () => {
    const walletAddress = "0x0ecd939b7fca4dc4a0675d8d28bad12cefae0954";
    const txA = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const txB = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const txC = "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
    const getLogs = vi.fn().mockImplementation(async (request: {
      fromBlock: bigint;
      toBlock: bigint;
      args?: { from?: string; to?: string };
      address?: readonly string[];
    }) => {
      if (request.toBlock - request.fromBlock > 9_999n) {
        throw new Error("eth_getLogs is limited to a 10,000 range");
      }

      if (request.address && request.args?.to === walletAddress) {
        return [{ transactionHash: txA }];
      }

      if (request.address && request.args?.from === walletAddress) {
        return [{ transactionHash: txC }];
      }

      if (request.args?.to === walletAddress) {
        return [{ transactionHash: txA }];
      }

      if (request.args?.from === walletAddress) {
        return [{ transactionHash: txB }];
      }

      return [];
    });

    vi.mocked(createBasePublicClient).mockReturnValue({ getLogs } as never);

    const service = new RpcLogCandidateTransactionService();
    const result = await service.discover({
      walletAddress,
      fromBlock: 0n,
      toBlock: 19_999n
    });

    expect(result.fixtureWallet).toBeNull();
    expect(result.observationCorpus).toEqual([]);
    expect(result.txHashes).toEqual([txA, txB, txC]);
    expect(result.providerKey).toBe("rpc_logs");
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: 0n,
        toBlock: 9_999n
      })
    );
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: 10_000n,
        toBlock: 19_999n
      })
    );
    expect(createBasePublicClient).toHaveBeenCalledWith(["https://base-mainnet.infura.io/v3/example"]);
    expect(getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: expect.arrayContaining(["0x827922686190790b37229fd06084350e74485b72"])
      })
    );
  });

  it("prefers the indexed provider when configured", async () => {
    const provider = {
      providerKey: "basescan_v2",
      isConfigured: vi.fn().mockReturnValue(true),
      discover: vi.fn().mockResolvedValue([
        {
          txHash: "0x1111",
          blockNumber: 10n,
          transactionIndex: 1,
          sourceKind: "native",
          timestamp: null
        },
        {
          txHash: "0x2222",
          blockNumber: 11n,
          transactionIndex: 0,
          sourceKind: "erc20",
          timestamp: null
        }
      ])
    };
    const fallback = {
      providerKey: "rpc_logs",
      discover: vi.fn()
    };

    const service = new LiveCandidateTransactionService(provider as never, fallback as never);
    const result = await service.discover({
      walletAddress: "0xabc",
      fromBlock: 0n,
      toBlock: 100n
    });

    expect(result.txHashes).toEqual(["0x1111", "0x2222"]);
    expect(result.providerKey).toBe("basescan_v2");
    expect(fallback.discover).not.toHaveBeenCalled();
  });
});