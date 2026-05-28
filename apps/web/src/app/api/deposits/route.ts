import { NextResponse } from "next/server";

import { getDepositsErrorStatus, parseDepositsListRequest } from "@/server/deposits/deposits.route";
import { getDepositsList } from "@/server/deposits/deposits.service";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: Request) {
  try {
    const input = await parseDepositsListRequest(request);
    const response = await getDepositsList(input);
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
