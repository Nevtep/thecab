import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@/server/db/client";

export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);

    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "error",
        code: "HEALTHCHECK_FAILED",
        message,
      },
      { status: 500 },
    );
  }
}
