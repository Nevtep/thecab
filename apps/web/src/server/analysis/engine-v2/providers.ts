export type EngineV2ProviderKind = "moralis" | "alchemy" | "explorer" | "sourcify" | "rpc" | "lpsugar";

export type EngineV2ProviderRequestDescriptor = {
  provider: EngineV2ProviderKind;
  endpoint: string;
  naturalKey: string;
  request: Record<string, unknown>;
};

export function createProviderRequestDescriptor(input: EngineV2ProviderRequestDescriptor) {
  return input;
}

// Engine V2 provider access is intentionally isolated to analysis/Trigger code.
// Route modules must consume persisted read models and must not import this file.
export const ENGINE_V2_PROVIDER_BOUNDARY = "analysis-only";
