import { handleGovernanceGet } from "@/server/governance/governance.route";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleGovernanceGet(request);
}
