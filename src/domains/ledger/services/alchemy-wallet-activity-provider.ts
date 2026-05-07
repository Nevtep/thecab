import {
  type DiscoveredWalletActivity,
  type WalletActivityDiscoveryProvider,
  type WalletActivityDiscoveryResult
} from "@/domains/ledger/services/wallet-activity-discovery-provider";

const ALCHEMY_DEFAULT_BASE_URL = "https://base-mainnet.g.alchemy.com/v2";

type AlchemyTransferItem = {
  hash?: string;
  blockNum?: string;
  metadata?: {
    blockTimestamp?: string;
  };
};

type AlchemyTransferResponse = {
  transfers?: AlchemyTransferItem[];
  pageKey?: string;
};

export class AlchemyWalletActivityProvider implements WalletActivityDiscoveryProvider {
  readonly providerKey = "alchemy_v2";

  isConfigured() {
    return this.getApiKey().length > 0;
  }

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    providerCursor?: string | null;
  }): Promise<WalletActivityDiscoveryResult> {
    const incoming = await this.fetchTransfers({
      walletAddress: input.walletAddress,
      fromBlock: input.fromBlock,
      toBlock: input.toBlock,
      direction: "to",
      pageKey: input.providerCursor ?? null
    });
    const outgoing = await this.fetchTransfers({
      walletAddress: input.walletAddress,
      fromBlock: input.fromBlock,
      toBlock: input.toBlock,
      direction: "from",
      pageKey: null
    });

    const activities = [...incoming.transfers, ...outgoing.transfers];

    return {
      activities: this.deduplicate(activities.map((transfer) => this.toActivity(transfer))),
      providerCursor: incoming.pageKey ?? null
    };
  }

  private async fetchTransfers(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    direction: "to" | "from";
    pageKey: string | null;
  }) {
    const payload = {
      id: 1,
      jsonrpc: "2.0",
      method: "alchemy_getAssetTransfers",
      params: [
        {
          fromBlock: this.toHex(input.fromBlock),
          toBlock: this.toHex(input.toBlock),
          category: ["external", "internal", "erc20", "erc721", "erc1155"],
          withMetadata: true,
          maxCount: "0x3e8",
          [input.direction === "to" ? "toAddress" : "fromAddress"]: input.walletAddress,
          pageKey: input.pageKey ?? undefined
        }
      ]
    };

    const response = await fetch(this.getEndpoint(), {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Alchemy transfer request failed with status ${response.status}.`);
    }

    const json = (await response.json()) as {
      result?: AlchemyTransferResponse;
    };

    return {
      transfers: json.result?.transfers ?? [],
      pageKey: json.result?.pageKey ?? null
    };
  }

  private toActivity(item: AlchemyTransferItem): DiscoveredWalletActivity {
    return {
      txHash: (item.hash ?? "").toLowerCase(),
      blockNumber: this.parseBlock(item.blockNum),
      transactionIndex: null,
      sourceKind: "defi",
      timestamp: this.parseTimestamp(item.metadata?.blockTimestamp)
    };
  }

  private deduplicate(activities: DiscoveredWalletActivity[]) {
    const ordered = new Map<string, DiscoveredWalletActivity>();

    for (const activity of activities) {
      if (!activity.txHash) {
        continue;
      }

      const existing = ordered.get(activity.txHash);
      if (!existing || this.compareActivity(activity, existing) < 0) {
        ordered.set(activity.txHash, activity);
      }
    }

    return [...ordered.values()].sort((left, right) => this.compareActivity(left, right));
  }

  private compareActivity(left: DiscoveredWalletActivity, right: DiscoveredWalletActivity) {
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber < right.blockNumber ? -1 : 1;
    }

    const leftIndex = left.transactionIndex ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = right.transactionIndex ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.txHash.localeCompare(right.txHash);
  }

  private parseBlock(value: string | undefined) {
    if (!value) {
      return 0n;
    }

    if (value.startsWith("0x")) {
      return BigInt(value);
    }

    return BigInt(value);
  }

  private parseTimestamp(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toHex(value: bigint) {
    return `0x${value.toString(16)}`;
  }

  private getApiKey() {
    return process.env.ALCHEMY_API_KEY?.trim() ?? "";
  }

  private getEndpoint() {
    const baseUrl = process.env.ALCHEMY_API_BASE_URL?.trim() || ALCHEMY_DEFAULT_BASE_URL;
    const suffix = baseUrl.endsWith("/") ? "" : "/";
    return `${baseUrl}${suffix}${this.getApiKey()}`;
  }
}
