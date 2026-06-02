import { z } from "zod";

import { errorResponse, runStartAnalysis, startAnalysisSchema } from "./start-analysis";

export async function POST(request: Request) {
  try {
    const payload = startAnalysisSchema.parse(await request.json());
    return runStartAnalysis(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse("invalid_payload", 400, error.issues);
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    const code = message.startsWith("UNSUPPORTED_CHAIN")
      ? "unsupported_chain"
      : message.startsWith("ANALYSIS_REQUEST_FAILED:UNAUTHORIZED")
        ? "unauthorized"
        : "internal_error";

    return errorResponse(
      code,
      code === "unsupported_chain" ? 400 : code === "unauthorized" ? 401 : 500,
    );
  }
}
