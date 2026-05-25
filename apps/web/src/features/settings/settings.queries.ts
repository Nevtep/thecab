import { apiClient } from "@/queries/apiClient";

import type {
  SettingsPersistedPreferencePatch,
  SettingsQueryInput,
  SettingsResponse,
  SettingsUpdateRequest,
} from "@/features/settings/settings.types";

export function buildSettingsPath({ walletAddress, chainId }: SettingsQueryInput) {
  const searchParams = new URLSearchParams({
    walletAddress,
    chainId: String(chainId),
  });

  return `/api/settings?${searchParams.toString()}`;
}

export async function fetchSettings(input: SettingsQueryInput) {
  return apiClient<SettingsResponse>(buildSettingsPath(input));
}

export function buildSettingsUpdateRequest(
  input: SettingsQueryInput & { preferences: SettingsPersistedPreferencePatch },
): SettingsUpdateRequest {
  return {
    walletAddress: input.walletAddress,
    chainId: input.chainId,
    preferences: input.preferences,
  };
}