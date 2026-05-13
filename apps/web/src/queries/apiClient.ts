type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

export async function apiClient<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const code =
      typeof errorBody === "object" && errorBody && "code" in errorBody
        ? String(errorBody.code)
        : "API_REQUEST_FAILED";
    throw new Error(code);
  }

  return (await response.json()) as T;
}
