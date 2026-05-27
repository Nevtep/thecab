import { NextResponse } from "next/server";

import { getPoolDetail } from "@/server/pools/pools.service";
import { getPoolsErrorStatus, parsePoolDetailRequest } from "@/server/pools/pools.route";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request, context: { params: Promise<{ poolId: string }> }) {
  try {
    const { poolId } = await context.params;
    const input = await parsePoolDetailRequest(request, poolId);
    const response = await getPoolDetail(input);
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