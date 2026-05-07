declare global {
  var __theCabActiveReconstructionRuns__: Set<string> | undefined;
}

function getActiveReconstructionRuns() {
  globalThis.__theCabActiveReconstructionRuns__ ??= new Set<string>();
  return globalThis.__theCabActiveReconstructionRuns__;
}

export function markReconstructionRunActive(reconstructionRunId: string) {
  getActiveReconstructionRuns().add(reconstructionRunId);
}

export function markReconstructionRunInactive(reconstructionRunId: string) {
  getActiveReconstructionRuns().delete(reconstructionRunId);
}

export function isReconstructionRunActive(reconstructionRunId: string) {
  return getActiveReconstructionRuns().has(reconstructionRunId);
}