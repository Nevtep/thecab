import { type ReconstructionRunRecord } from "@/domains/ledger/repositories/reconstruction-run-repository";

export function resolveAcceptedRunChain(acceptedRuns: ReconstructionRunRecord[]) {
  if (acceptedRuns.length === 0) {
    return [] as ReconstructionRunRecord[];
  }

  let latestBaselineIndex = -1;
  for (let index = acceptedRuns.length - 1; index >= 0; index -= 1) {
    const run = acceptedRuns[index];
    if (run && (run.runMode === "initial" || run.runMode === "replay")) {
      latestBaselineIndex = index;
      break;
    }
  }

  return latestBaselineIndex >= 0 ? acceptedRuns.slice(latestBaselineIndex) : acceptedRuns;
}