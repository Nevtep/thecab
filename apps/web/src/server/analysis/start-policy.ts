export function shouldEnforceCompletedRunDailyGate(nodeEnv: string | undefined = process.env.NODE_ENV ?? "development") {
  return nodeEnv === "production";
}

export function shouldReuseCompletedSameDayRun(input: {
  sameDayRunStatus: string | null | undefined;
  requestedMode?: "full_history" | "incremental";
  nodeEnv?: string;
}) {
  return input.requestedMode !== "incremental"
    && input.sameDayRunStatus === "complete"
    && shouldEnforceCompletedRunDailyGate(input.nodeEnv);
}

export function shouldSupersedeCompletedSameDayRunForDevelopment(input: {
  sameDayRunStatus: string | null | undefined;
  requestedMode?: "full_history" | "incremental";
  nodeEnv?: string;
}) {
  return input.requestedMode !== "incremental"
    && input.sameDayRunStatus === "complete"
    && !shouldEnforceCompletedRunDailyGate(input.nodeEnv);
}