import { POST as createAnalysisSession } from "@/app/api/analysis-sessions/route";
import { GET as getSessionStatus } from "@/app/api/analysis-sessions/[sessionId]/route";
import { POST as startReconstruction } from "@/app/api/analysis-sessions/[sessionId]/reconstructions/route";
import { GET as getLedgerProjection } from "@/app/api/analysis-sessions/[sessionId]/ledger/route";
import { GET as getLedgerRecordDetail } from "@/app/api/analysis-sessions/[sessionId]/ledger/events/[ledgerRecordId]/route";
import { GET as getDiscardedActivity } from "@/app/api/analysis-sessions/[sessionId]/discarded-activity/route";

const RUN_SETTLED_STATUSES = new Set(["accepted", "failed"]);

export async function createSession(
  walletAddress: string,
  options?: {
    chainId?: number;
    connectionSource?: string;
  }
) {
  const response = await createAnalysisSession(
    new Request("http://localhost/api/analysis-sessions", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        chainId: options?.chainId ?? 8453,
        connectionSource: options?.connectionSource ?? "walletconnect"
      }),
      headers: {
        "content-type": "application/json"
      }
    }) as never
  );

  return {
    response,
    body: await response.json()
  };
}

export async function fetchSessionStatus(sessionId: string) {
  const response = await getSessionStatus(new Request("http://localhost") as never, {
    params: Promise.resolve({ sessionId })
  });

  return {
    response,
    body: await response.json()
  };
}

async function waitForReconstructionSettlement(
  sessionId: string,
  reconstructionRunId: string,
  options?: {
    timeoutMs?: number;
    pollIntervalMs?: number;
  }
) {
  const timeoutMs = options?.timeoutMs ?? 6_000;
  const pollIntervalMs = options?.pollIntervalMs ?? 25;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const status = await fetchSessionStatus(sessionId);
    const latestRun = status.body.latestRun;

    if (latestRun?.reconstructionRunId === reconstructionRunId && RUN_SETTLED_STATUSES.has(latestRun.status)) {
      return {
        response: status.response,
        body: latestRun
      };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for reconstruction run ${reconstructionRunId} to settle.`);
}

export async function reconstructSession(
  sessionId: string,
  options?: {
    mode?: "initial" | "incremental" | "replay";
    waitForSettlement?: boolean;
    timeoutMs?: number;
  }
) {
  const response = await startReconstruction(
    new Request(`http://localhost/api/analysis-sessions/${sessionId}/reconstructions`, {
      method: "POST",
      body: JSON.stringify({ mode: options?.mode ?? "replay" }),
      headers: {
        "content-type": "application/json"
      }
    }) as never,
    { params: Promise.resolve({ sessionId }) }
  );

  const body = await response.json();

  if (!response.ok || options?.waitForSettlement === false || !body.reconstructionRunId) {
    return {
      response,
      body
    };
  }

  if (RUN_SETTLED_STATUSES.has(body.status)) {
    return {
      response,
      body
    };
  }

  const settledRun = await waitForReconstructionSettlement(sessionId, body.reconstructionRunId, {
    timeoutMs: options?.timeoutMs
  });

  return {
    response,
    body: settledRun.body
  };
}

export async function fetchLedger(sessionId: string) {
  const response = await getLedgerProjection(new Request("http://localhost") as never, {
    params: Promise.resolve({ sessionId })
  });
  return {
    response,
    body: await response.json()
  };
}

export async function fetchLedgerRecord(sessionId: string, ledgerRecordId: string) {
  const response = await getLedgerRecordDetail(new Request("http://localhost") as never, {
    params: Promise.resolve({ sessionId, ledgerRecordId })
  });
  return {
    response,
    body: await response.json()
  };
}

export async function fetchDiscardedActivity(sessionId: string) {
  const response = await getDiscardedActivity(new Request("http://localhost") as never, {
    params: Promise.resolve({ sessionId })
  });
  return {
    response,
    body: await response.json()
  };
}