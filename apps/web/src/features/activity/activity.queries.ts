import type { ActivityUrlState, ActivityViewModel } from "@/features/activity/activity.types";
import { buildActivityApiQueryString, normalizeActivityFiltersForQueryKey } from "@/features/activity/activity.urlState";
import { apiClient } from "@/queries/apiClient";
import { queryKeys } from "@/queries/keys";

export function getActivityQueryOptions(input: {
  chainId: number;
  walletAddress: string;
  state: ActivityUrlState;
}) {
  return {
    queryKey: queryKeys.activity({
      chainId: input.chainId,
      walletAddress: input.walletAddress,
      filters: normalizeActivityFiltersForQueryKey(input.state),
    }),
    queryFn: () =>
      apiClient<ActivityViewModel>(
        `/api/activity?${buildActivityApiQueryString({ chainId: input.chainId, state: input.state })}`,
      ),
    placeholderData: (previousData: ActivityViewModel | undefined) => previousData,
  };
}
