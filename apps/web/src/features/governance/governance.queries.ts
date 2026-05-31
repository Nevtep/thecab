import type { GovernanceUrlState, GovernanceViewModel } from "@/features/governance/governance.types";
import { buildGovernanceApiQueryString, normalizeGovernanceFiltersForQueryKey } from "@/features/governance/governance.urlState";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

export function getGovernanceQueryOptions(input: {
  chainId: number;
  walletAddress: string;
  state: GovernanceUrlState;
}) {
  return {
    queryKey: queryKeys.governance({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: normalizeGovernanceFiltersForQueryKey(input.state),
    }),
    queryFn: () =>
      apiClient<GovernanceViewModel>(
        `/api/governance?${buildGovernanceApiQueryString({ chainId: input.chainId, state: input.state })}`,
      ),
    placeholderData: (previousData: GovernanceViewModel | undefined) => previousData,
  };
}
