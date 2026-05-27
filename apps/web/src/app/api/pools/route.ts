import { NextResponse } from "next/server";

import { getPoolsList } from "@/server/pools/pools.service";
import { getPoolsErrorStatus, parsePoolsListRequest } from "@/server/pools/pools.route";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  try {
    const input = await parsePoolsListRequest(request);
    const response = await getPoolsList(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getPoolsErrorStatus(error);
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