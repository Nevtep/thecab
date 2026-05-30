import { handleRewardsGet } from "@/server/rewards/rewards.route";

export async function GET(request: Request) {
  return handleRewardsGet(request);
}
