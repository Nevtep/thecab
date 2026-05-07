import { logger } from "@/infrastructure/observability/logger";

import {
  type DiscoveredWalletActivity,
  type WalletActivityDiscoveryResult,
  type WalletActivityDiscoveryProvider
} from "@/domains/ledger/services/wallet-activity-discovery-provider";

const BASESCAN_CHAIN_ID = "8453";
const DEFAULT_BASESCAN_API_BASE_URL = "https://api.etherscan.io/v2/api";
const DEFAULT_BASESCAN_PAGE_SIZE = 100;

type BasescanAction = "txlist" | "txlistinternal" | "tokentx" | "tokennfttx";

type BasescanActivityRecord = {
  hash?: string;
  blockNumber?: string;
  transactionIndex?: string;
  timeStamp?: string;
};

type BasescanResponse = {
  status?: string;
  message?: string;
  result?: BasescanActivityRecord[] | string | null;
};

export class BasescanWalletActivityProvider implements WalletActivityDiscoveryProvider {
  readonly providerKey = "basescan_v2";

  isConfigured() {
    return this.getApiKey().length > 0;
  }

  async discover(input: {
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    providerCursor?: string | null;
  }): Promise<WalletActivityDiscoveryResult> {
    const walletAddress = input.walletAddress.toLowerCase();
    const responses = await Promise.all([
      this.collectAction("txlist", walletAddress, input.fromBlock, input.toBlock),
      this.collectAction("txlistinternal", walletAddress, input.fromBlock, input.toBlock),
      this.collectAction("tokentx", walletAddress, input.fromBlock, input.toBlock),
      this.collectAction("tokennfttx", walletAddress, input.fromBlock, input.toBlock)
    ]);

    const ordered = new Map<string, DiscoveredWalletActivity>();

    for (const activity of responses.flat()) {
      const existing = ordered.get(activity.txHash);
      if (!existing || this.compareActivity(activity, existing) < 0) {
        ordered.set(activity.txHash, activity);
      }
    }

    return {
      activities: [...ordered.values()].sort((left, right) => this.compareActivity(left, right)),
      providerCursor: null
    };
  }

  private async collectAction(
    action: BasescanAction,
    walletAddress: string,
    fromBlock: bigint,
    toBlock: bigint
  ) {
    const activities: DiscoveredWalletActivity[] = [];
    const pageSize = this.getPageSize();

    for (let page = 1; ; page += 1) {
      const records = await this.fetchActivityPage({
        action,
        walletAddress,
        fromBlock,
        toBlock,
        page,
        pageSize
      });

      activities.push(...records.map((record) => this.toActivity(record, action)));

      if (records.length < pageSize) {
        return activities;
      }
    }
  }

  private async fetchActivityPage(input: {
    action: BasescanAction;
    walletAddress: string;
    fromBlock: bigint;
    toBlock: bigint;
    page: number;
    pageSize: number;
  }) {
    const searchParams = new URLSearchParams({
      chainid: BASESCAN_CHAIN_ID,
      module: "account",
      action: input.action,
      address: input.walletAddress,
      startblock: input.fromBlock.toString(),
      endblock: input.toBlock.toString(),
      page: input.page.toString(),
      offset: input.pageSize.toString(),
      sort: "asc",
      apikey: this.getApiKey()
    });
    const response = await fetch(`${this.getBaseUrl()}?${searchParams.toString()}`);

    if (!response.ok) {
      throw new Error(`BaseScan request failed with status ${response.status}.`);
    }

    const payload = await response.json() as BasescanResponse;
    if (Array.isArray(payload.result)) {
      return payload.result.filter((record) => typeof record.hash === "string" && record.hash.length > 0);
    }

    const message = typeof payload.result === "string"
      ? payload.result
      : payload.message ?? "Unknown BaseScan response.";

    if (message.toLowerCase().includes("no transactions found")) {
      return [];
    }

    logger.warn("BaseScan wallet activity request returned a non-array payload.", {
      action: input.action,
      message
    });
    throw new Error(`BaseScan ${input.action} failed: ${message}`);
  }

  private toActivity(record: BasescanActivityRecord, action: BasescanAction): DiscoveredWalletActivity {
    return {
      txHash: (record.hash ?? "").toLowerCase(),
      blockNumber: BigInt(record.blockNumber ?? "0"),
      transactionIndex: this.parseNumber(record.transactionIndex),
      sourceKind: this.toSourceKind(action),
      timestamp: this.parseTimestamp(record.timeStamp)
    };
  }

  private toSourceKind(action: BasescanAction): DiscoveredWalletActivity["sourceKind"] {
    switch (action) {
      case "txlist":
        return "native";
      case "txlistinternal":
        return "internal";
      case "tokentx":
        return "erc20";
      case "tokennfttx":
        return "erc721";
    }
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

  private parseNumber(value: string | undefined) {
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

    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds)) {
      return null;
    }

    return new Date(seconds * 1000);
  }

  private getApiKey() {
    return process.env.BASESCAN_API_KEY?.trim() ?? "";
  }

  private getBaseUrl() {
    return process.env.BASESCAN_API_BASE_URL?.trim() || DEFAULT_BASESCAN_API_BASE_URL;
  }

  private getPageSize() {
    const configured = Number.parseInt(process.env.BASESCAN_PAGE_SIZE ?? "", 10);
    if (!Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_BASESCAN_PAGE_SIZE;
    }

    return configured;
  }
}