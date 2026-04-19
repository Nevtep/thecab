import { expect, test, type Page } from "@playwright/test";

async function installMockInjectedWallet(
  page: Page,
  input: {
    chainIdHex: string;
    accounts?: string[];
  }
) {
  await page.addInitScript(({ chainIdHex, accounts }) => {
    class MockEthereumProvider {
      chainId: string;
      selectedAddress: string | null;
      accounts: string[];
      isMetaMask = true;
      providers: unknown[];
      listeners = new Map<string, Array<(...args: unknown[]) => void>>();

      constructor(initialChainId: string, initialAccounts: string[]) {
        this.chainId = initialChainId.toLowerCase();
        this.accounts = initialAccounts;
        this.selectedAddress = initialAccounts[0] ?? null;
        this.providers = [this];
      }

      on(event: string, listener: (...args: unknown[]) => void) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push(listener);
        this.listeners.set(event, listeners);
        return this;
      }

      removeListener(event: string, listener: (...args: unknown[]) => void) {
        const listeners = this.listeners.get(event) ?? [];
        this.listeners.set(
          event,
          listeners.filter((registeredListener) => registeredListener !== listener)
        );
        return this;
      }

      emit(event: string, ...args: unknown[]) {
        const listeners = this.listeners.get(event) ?? [];
        for (const listener of listeners) {
          listener(...args);
        }
      }

      async request({ method, params }: { method: string; params?: Array<Record<string, string>> }) {
        switch (method) {
          case "eth_requestAccounts":
          case "eth_accounts": {
            this.selectedAddress = this.accounts[0] ?? null;
            return this.accounts;
          }
          case "eth_chainId":
            return this.chainId;
          case "net_version":
            return Number.parseInt(this.chainId, 16).toString();
          case "wallet_switchEthereumChain": {
            const nextChainId = params?.[0]?.chainId ?? "0x2105";
            this.chainId = nextChainId.toLowerCase();
            this.emit("chainChanged", this.chainId);
            return null;
          }
          case "wallet_requestPermissions":
            return [{ parentCapability: "eth_accounts" }];
          case "wallet_getPermissions":
            return [{ parentCapability: "eth_accounts" }];
          default:
            return null;
        }
      }

      async enable() {
        return this.request({ method: "eth_requestAccounts" });
      }
    }

    Object.defineProperty(window, "ethereum", {
      configurable: true,
      value: new MockEthereumProvider(chainIdHex, accounts ?? ["0x1000000000000000000000000000000000000001"])
    });
  }, input);
}

async function installConnectedWalletTestOverride(
  page: Page,
  input: {
    walletAddress: string;
    chainId: number;
    connectorId?: string;
    connectorName?: string;
    isConnected?: boolean;
  }
) {
  await page.addInitScript((override) => {
    window.__THE_CAB_TEST_WALLET__ = {
      walletAddress: override.walletAddress,
      chainId: override.chainId,
      connectorId: override.connectorId ?? "injected",
      connectorName: override.connectorName ?? "Injected",
      isConnected: override.isConnected ?? true
    };
  }, input);
}

test("connects one injected wallet on Base and starts analysis from the connected wallet", async ({ page }) => {
  await installMockInjectedWallet(page, {
    chainIdHex: "0x2105",
    accounts: ["0x1000000000000000000000000000000000000011"]
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Connect with Injected" }).click();

  await expect(page.getByText("Network:")).toContainText("Base");
  await page.getByRole("button", { name: "Start analysis from connected wallet" }).click();

  await page.waitForURL(/\/ledger\?sessionId=/);
  await expect(page.getByRole("heading", { name: "Connected-wallet analysis" })).toBeVisible();
});

test("blocks session bootstrap on the wrong chain until the wallet switches to Base", async ({ page }) => {
  await installConnectedWalletTestOverride(page, {
    walletAddress: "0x1000000000000000000000000000000000000012",
    chainId: 1
  });

  await page.goto("/");

  await expect(page.getByText("Network:")).toContainText("Chain 1");
  await expect(page.getByRole("button", { name: "Switch to Base" })).toBeVisible();

  await page.getByRole("button", { name: "Switch to Base" }).click();
  await expect(page.getByText("Network:")).toContainText("Base");

  await page.getByRole("button", { name: "Start analysis from connected wallet" }).click();
  await page.waitForURL(/\/ledger\?sessionId=/);
});