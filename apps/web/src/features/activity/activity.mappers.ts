import type { ActivityResponse } from "@/server/activity/activity.types";

export function mapActivityResponseToViewModel(response: ActivityResponse): ActivityResponse {
  return {
    ...response,
    walletAddress: response.walletAddress.toLowerCase(),
    events: response.events,
  };
}
