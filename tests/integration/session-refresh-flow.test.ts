import {
  buildConnectedWalletSessionGuard,
  type ConnectedWalletContext
} from "@/ui/wallet/use-connected-wallet-analysis";
import {
  createSession,
  fetchLedger,
  fetchSessionStatus,
  reconstructSession
} from "@/tests/helpers/route-test-utils";
import { prepareDatabase, resetDatabase } from "@/tests/helpers/test-environment";

describe("session refresh flow", () => {
  beforeAll(async () => {
    await prepareDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  it("keeps the latest accepted ledger available while a reused session refresh is running", async () => {
    const { body: initialSession } = await createSession("0x2000000000000000000000000000000000000002");
    const acceptedRun = await reconstructSession(initialSession.sessionId);
    const { body: reusedSession } = await createSession("0x2000000000000000000000000000000000000002");

    const refreshRun = await reconstructSession(reusedSession.sessionId, {
      mode: "incremental",
      waitForSettlement: false
    });
    const statusDuringRefresh = await fetchSessionStatus(reusedSession.sessionId);
    const ledger = await fetchLedger(reusedSession.sessionId);

    expect(reusedSession.reusedSession).toBe(true);
    expect(["pending", "accepted"]).toContain(refreshRun.body.status);
    expect(statusDuringRefresh.body.session.reusedSession).toBe(true);
    expect(statusDuringRefresh.body.latestAcceptedRun.reconstructionRunId).toBe(
      acceptedRun.body.reconstructionRunId
    );
    if (refreshRun.body.status === "pending") {
      expect(statusDuringRefresh.body.latestRun.reconstructionRunId).toBe(
        refreshRun.body.reconstructionRunId
      );
      expect(["pending", "ingesting", "normalizing", "projecting"]).toContain(
        statusDuringRefresh.body.latestRun.status
      );
    } else {
      expect(statusDuringRefresh.body.latestRun.reconstructionRunId).toBe(
        acceptedRun.body.reconstructionRunId
      );
      expect(statusDuringRefresh.body.latestRun.status).toBe("accepted");
    }
    expect(statusDuringRefresh.body.hasAcceptedProjection).toBe(true);
    expect(ledger.body.pools.length).toBeGreaterThan(0);
  });

  it("builds a stale-context guard before a trusted session result is rendered", () => {
    const connectedWallet = {
      walletAddress: "0x3000000000000000000000000000000000000003",
      chainId: 8453,
      connectorId: "injected",
      connectorName: "Injected",
      isConnected: true
    } satisfies ConnectedWalletContext;

    const guard = buildConnectedWalletSessionGuard({
      connectedWallet,
      session: {
        walletAddress: "0x2000000000000000000000000000000000000002",
        chainId: 8453
      }
    });

    expect(guard.isCurrent).toBe(false);
    expect(guard.reason).toBe("wallet_mismatch");
  });
});