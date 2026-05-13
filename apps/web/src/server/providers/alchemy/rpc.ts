import { getEnv } from "@/server/env";

type JsonRpcPayload = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: unknown[];
};

type JsonRpcResponse<T> = {
  id: number;
  jsonrpc: "2.0";
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export async function alchemyRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const env = getEnv();
  const payload: JsonRpcPayload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const response = await fetch(env.ALCHEMY_BASE_RPC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ALCHEMY_RPC_HTTP_FAILED:${response.status}:${body}`);
  }

  const json = (await response.json()) as JsonRpcResponse<T>;
  if (json.error) {
    throw new Error(`ALCHEMY_RPC_FAILED:${json.error.code}:${json.error.message}`);
  }

  return json.result as T;
}
