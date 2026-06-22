import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import {
  getDepositsErrorStatus,
  normalizeDepositDetailQueryParams,
  normalizeDepositsListQueryParams,
} from "@/server/deposits/deposits.route";

test("normalizeDepositsListQueryParams resolves aliases defaults and named sorts", () => {
  const params = new URLSearchParams({
    chainId: "8453",
    pool: "a5f5ac32-5e8e-4e79-a180-1d3f9dc53482",
    from: "2026-05-01",
    to: "2026-05-28",
    returnSign: "any",
    sort: "apr_asc",
    page: "2",
    pageSize: "50",
  });

  const normalized = normalizeDepositsListQueryParams(params);

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.poolId, "a5f5ac32-5e8e-4e79-a180-1d3f9dc53482");
  assert.equal(normalized.startDayUtc, "2026-05-01");
  assert.equal(normalized.endDayUtc, "2026-05-28");
  assert.equal(normalized.returnSign, "all");
  assert.equal(normalized.sort, "estApr");
  assert.equal(normalized.direction, "asc");
  assert.equal(normalized.page, 2);
  assert.equal(normalized.pageSize, 50);
});

test("normalizeDepositsListQueryParams rejects invalid sort and oversized date windows", () => {
  assert.throws(
    () => normalizeDepositsListQueryParams(new URLSearchParams({ sort: "unknown_sort" })),
    /INVALID_PAYLOAD/,
  );

  assert.throws(
    () => normalizeDepositsListQueryParams(new URLSearchParams({ from: "2025-01-01", to: "2026-05-28" })),
    /INVALID_PAYLOAD/,
  );
});

test("normalizeDepositDetailQueryParams validates chain and deposit id", () => {
  const normalized = normalizeDepositDetailQueryParams(
    new URLSearchParams({ chainId: "8453" }),
    "8453:0x827922686190790b37229fd06084350e74485b72:71663333",
  );

  assert.equal(normalized.chainId, 8453);
  assert.equal(normalized.depositId, "8453:0x827922686190790b37229fd06084350e74485b72:71663333");

  assert.throws(
    () => normalizeDepositDetailQueryParams(new URLSearchParams(), "bad/deposit"),
    /INVALID_PAYLOAD/,
  );
});

test("getDepositsErrorStatus maps request failures to stable codes", () => {
  const schema = z.object({ limit: z.number().int() });
  const parseResult = schema.safeParse({ limit: "nope" });
  assert.equal(parseResult.success, false);
  if (parseResult.success) {
    return;
  }

  assert.equal(getDepositsErrorStatus(parseResult.error).code, "invalid_payload");
  assert.equal(getDepositsErrorStatus(new Error("UNSUPPORTED_CHAIN:1")).code, "unsupported_chain");
  assert.equal(getDepositsErrorStatus(new Error("DEPOSITS_REQUEST_FAILED:UNAUTHORIZED")).code, "unauthorized");
  assert.equal(getDepositsErrorStatus(new Error("DEPOSITS_REQUEST_FAILED:ANALYSIS_REQUIRED")).code, "analysis_required");
  assert.equal(getDepositsErrorStatus(new Error("DEPOSITS_REQUEST_FAILED:DEPOSIT_NOT_FOUND")).code, "deposit_not_found");
  assert.equal(getDepositsErrorStatus(new Error("DEPOSITS_REQUEST_FAILED:DEPOSIT_NOT_FOUND:OWNERSHIP_MISMATCH")).code, "deposit_not_found");
  assert.equal(getDepositsErrorStatus(new Error("DEPOSITS_REQUEST_FAILED:RECONCILIATION_DRIFT")).code, "internal_error");
  assert.equal(getDepositsErrorStatus(new Error("unexpected boom")).code, "internal_error");
});
