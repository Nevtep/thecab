import { NextResponse } from "next/server";

import { getRecentOverviewChart } from "@/server/overview/getRecentOverview";
import {
  assertNoProviderLeakage,
  getOverviewErrorResponse,
  parseOverviewRequest,
  sanitizeOverviewResponse,
} from "@/server/overview/overview.route";

export async function GET(request: Request) {
  try {
    const payload = parseOverviewRequest(request);
    const overview = await getRecentOverviewChart(payload);

    return NextResponse.json(assertNoProviderLeakage(sanitizeOverviewResponse(overview)));
  } catch (error) {
    return getOverviewErrorResponse(error);
  }
}