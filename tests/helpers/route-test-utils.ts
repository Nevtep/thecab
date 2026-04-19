import { POST as createAnalysisSession } from "@/app/api/analysis-sessions/route";
import { POST as startReconstruction } from "@/app/api/analysis-sessions/[sessionId]/reconstructions/route";
import { GET as getLedgerProjection } from "@/app/api/analysis-sessions/[sessionId]/ledger/route";
import { GET as getLedgerRecordDetail } from "@/app/api/analysis-sessions/[sessionId]/ledger/events/[ledgerRecordId]/route";
import { GET as getDiscardedActivity } from "@/app/api/analysis-sessions/[sessionId]/discarded-activity/route";

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

export async function reconstructSession(sessionId: string) {
  const response = await startReconstruction(
    new Request(`http://localhost/api/analysis-sessions/${sessionId}/reconstructions`, {
      method: "POST",
      body: JSON.stringify({ mode: "replay" }),
      headers: {
        "content-type": "application/json"
      }
    }) as never,
    { params: Promise.resolve({ sessionId }) }
  );

  return {
    response,
    body: await response.json()
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