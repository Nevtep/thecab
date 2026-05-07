import { logger } from "@/infrastructure/observability/logger";

import {
  type DiscoveredWalletActivity,
  type WalletActivityDiscoveryProvider,
  type WalletActivityDiscoveryResult
} from "@/domains/ledger/services/wallet-activity-discovery-provider";

const MORALIS_DEFAULT_BASE_URL = "https://deep-index.moralis.io/api/v2.2";
const MORALIS_CHAIN = "base";

type MoralisWalletHistoryItem = {
  hash?: string;
  block_number?: string;
  transaction_index?: string;
  block_timestamp?: string;
};

type MoralisWalletHistoryResponse = {
  cursor?: string | null;
  result?: MoralisWalletHistoryItem[];
};

export class MoralisWalletActivityProvider implements WalletActivityDiscoveryProvider {
  readonly providerKey = "moralis_v2";

  isConfigured() {
    return this.getApiKey().length > 0;
  }

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    providerCursor?: string | null;
  }): Promise<WalletActivityDiscoveryResult> {
    const activities: DiscoveredWalletActivity[] = [];
    let cursor = input.providerCursor ?? null;

    for (;;) {
      const page = await this.fetchWalletHistoryPage({
        walletAddress: input.walletAddress.toLowerCase(),
        fromBlock: input.fromBlock,
        toBlock: input.toBlock,
        cursor
      });

      const pageActivities = (page.result ?? [])
        .filter((item) => typeof item.hash === "string" && item.hash.length > 0)
        .map((item) => this.toActivity(item));

      activities.push(...pageActivities);

      if (!page.cursor || page.cursor === cursor) {
        return {
          activities: this.deduplicate(activities),
          providerCursor: page.cursor ?? null
        };
      }

      cursor = page.cursor;
    }
  }

  private async fetchWalletHistoryPage(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    cursor: string | null;
  }) {
    const baseUrl = this.getBaseUrl().endsWith("/") ? this.getBaseUrl().slice(0, -1) : this.getBaseUrl();
    const searchParams = new URLSearchParams({
      chain: MORALIS_CHAIN,
      from_block: input.fromBlock.toString(),
      to_block: input.toBlock.toString()
    });
    if (input.cursor) {
      searchParams.set("cursor", input.cursor);
    }

    const response = await fetch(`${baseUrl}/${input.walletAddress}/history?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "X-API-Key": this.getApiKey()
      }
    });

    if (!response.ok) {
      throw new Error(`Moralis wallet history request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as MoralisWalletHistoryResponse;
    if (!Array.isArray(payload.result)) {
      logger.warn("Moralis wallet history returned a non-array result payload.", {
        walletAddress: input.walletAddress,
        hasCursor: Boolean(payload.cursor)
      });
      return {
        cursor: payload.cursor ?? null,
        result: []
      } satisfies MoralisWalletHistoryResponse;
    }

    return payload;
  }

  private toActivity(item: MoralisWalletHistoryItem): DiscoveredWalletActivity {
    return {
      txHash: (item.hash ?? "").toLowerCase(),
      blockNumber: BigInt(item.block_number ?? "0"),
      transactionIndex: this.parseInteger(item.transaction_index),
      sourceKind: "native",
      timestamp: this.parseTimestamp(item.block_timestamp)
    };
  }

  private deduplicate(activities: DiscoveredWalletActivity[]) {
    const ordered = new Map<string, DiscoveredWalletActivity>();

    for (const activity of activities) {
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

  private parseInteger(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private parseTimestamp(value: string | undefined) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private getApiKey() {
    return process.env.MORALIS_API_KEY?.trim() ?? "";
  }

  private getBaseUrl() {
    return process.env.MORALIS_API_BASE_URL?.trim() || MORALIS_DEFAULT_BASE_URL;
  }
}
