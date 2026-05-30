import { NextResponse } from "next/server";

import { getStrategyDetail } from "@/server/strategies/strategies.service";
import { getStrategiesErrorStatus, parseStrategyDetailRequest } from "@/server/strategies/strategies.route";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request, context: { params: Promise<{ strategyId: string }> }) {
  try {
    const { strategyId } = await context.params;
    const input = await parseStrategyDetailRequest(request, strategyId);
    const response = await getStrategyDetail(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getStrategiesErrorStatus(error);
    return NextResponse.json(
      {
        error: {
          code: failure.code,
          ...(failure.details === undefined ? {} : { details: failure.details }),
        },
      },
      {
        status: failure.status,
        headers: RESPONSE_HEADERS,
      },
    );
  }
}

