import { NextResponse } from "next/server";

import { getStrategiesList } from "@/server/strategies/strategies.service";
import { getStrategiesErrorStatus, parseStrategiesListRequest } from "@/server/strategies/strategies.route";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  try {
    const input = await parseStrategiesListRequest(request);
    const response = await getStrategiesList(input);
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

