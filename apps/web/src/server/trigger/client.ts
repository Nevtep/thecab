import { getEnv } from "@/server/env";

import type { AnalyzeWalletPayload } from "@/server/analysis/analyzeWalletTask";

export async function triggerAnalyzeWalletTask(payload: AnalyzeWalletPayload): Promise<void> {
  // Phase 0 skeleton: keep env validation and payload shape stable.
  // Queue wiring can switch to Trigger.dev SDK runner in Phase D without changing call sites.
  getEnv();
  void payload;
}
