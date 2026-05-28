import { NextResponse } from "next/server";

import { getDepositDetail } from "@/server/deposits/deposits.service";
import { getDepositsErrorStatus, parseDepositDetailRequest } from "@/server/deposits/deposits.route";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request, ctx: { params: Promise<{ depositId: string }> }) {
  try {
    const { depositId } = await ctx.params;
    const input = await parseDepositDetailRequest(request, depositId);
    const response = await getDepositDetail(input);
    return NextResponse.json(response, { headers: RESPONSE_HEADERS });
  } catch (error) {
    const failure = getDepositsErrorStatus(error);
    return NextResponse.json(
      {
        error: {
          code: failure.code,
          ...(failure.details === undefined ? {} : { details: failure.details }),
        },
      },
      { status: failure.status, headers: RESPONSE_HEADERS },
    );
  }
}
