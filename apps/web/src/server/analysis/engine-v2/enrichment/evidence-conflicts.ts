export type EvidenceDecision =
  | { status: "accepted"; coverageStatus: "full"; reasonCodes: string[] }
  | { status: "conflict"; coverageStatus: "partial"; reasonCodes: string[] };

export function resolveEvidenceConflict(input: {
  expected?: unknown;
  observed?: unknown;
  reasonCode?: string;
}): EvidenceDecision {
  if (input.expected === undefined || input.observed === undefined || input.expected === input.observed) {
    return { status: "accepted", coverageStatus: "full", reasonCodes: [] };
  }

  return {
    status: "conflict",
    coverageStatus: "partial",
    reasonCodes: [input.reasonCode ?? "conflicting_evidence"],
  };
}

