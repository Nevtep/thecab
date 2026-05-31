import type { RewardsResponse } from "@/features/rewards/rewards.types";
import type { RewardsUrlState } from "@/features/rewards/rewards.types";
import { buildRewardsApiQueryString, normalizeRewardsFiltersForQueryKey } from "@/features/rewards/rewards.urlState";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

export function getRewardsQueryOptions(input: {
  chainId: number;
  walletAddress: string;
  state: RewardsUrlState;
}) {
  return {
    queryKey: queryKeys.rewards({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: normalizeRewardsFiltersForQueryKey(input.state),
    }),
    queryFn: () =>
      apiClient<RewardsResponse>(
        `/api/rewards?${buildRewardsApiQueryString({ chainId: input.chainId, state: input.state })}`,
      ),
    placeholderData: (previousData: RewardsResponse | undefined) => previousData,
  };
}
