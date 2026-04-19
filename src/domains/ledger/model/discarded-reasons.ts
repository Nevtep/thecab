export const DISCARDED_REASON_TYPES = ["unsupported", "malicious", "ambiguous", "invalid"] as const;

export const DISCARDED_REASON_CODES = {
  unsupportedProtocol: "unsupported_protocol",
  unsupportedAction: "unsupported_action",
  ambiguousClassification: "ambiguous_classification",
  invalidObservation: "invalid_observation",
  malformedFixture: "malformed_fixture",
  suspiciousActivity: "suspicious_activity"
} as const;

export type DiscardedReasonType = (typeof DISCARDED_REASON_TYPES)[number];
export type DiscardedReasonCode = (typeof DISCARDED_REASON_CODES)[keyof typeof DISCARDED_REASON_CODES];

export function isDiscardedReasonType(value: string): value is DiscardedReasonType {
  return DISCARDED_REASON_TYPES.includes(value as DiscardedReasonType);
}