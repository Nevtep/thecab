import { handleActivityGet } from "@/server/activity/activity.route";

export async function GET(request: Request) {
  return handleActivityGet(request);
}
