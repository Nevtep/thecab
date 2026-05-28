import assert from "node:assert/strict";
import test from "node:test";

import { parseDepositsListUrlState } from "@/features/deposits/deposits.urlState";
import { deriveDepositsScreenState } from "@/features/deposits/deposits.validation";

test("parseDepositsListUrlState drops invalid selected deposit ids and filter aliases", () => {
  const parsed = parseDepositsListUrlState(new URLSearchParams(
    "status=open_active&pool=invalid-pool&selectedDepositId=not-a-uuid&page=99999&pageSize=0",
  ));

  assert.deepEqual(parsed, {
    status: "open_active",
    poolId: null,
    startDayUtc: null,
    endDayUtc: null,
    returnSign: "all",
    sort: "openedAt",
    direction: "desc",
    page: 1,
    pageSize: 25,
    selectedDepositId: null,
  });
});

test("deriveDepositsScreenState preserves locked empty error and ready branches", () => {
  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: false,
      analysisStatus: null,
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: null,
      totalCount: null,
    }),
    "loading",
  );

  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: true,
      analysisStatus: "running",
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: null,
      totalCount: null,
    }),
    "locked",
  );

  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: true,
      analysisStatus: "ready",
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: "analysis_required",
      totalCount: null,
    }),
    "locked",
  );

  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: true,
      analysisStatus: "ready",
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: "invalid_request",
      totalCount: null,
    }),
    "error",
  );

  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: true,
      analysisStatus: "ready",
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: null,
      totalCount: 0,
    }),
    "empty",
  );

  assert.equal(
    deriveDepositsScreenState({
      isWalletReady: true,
      analysisStatus: "stale",
      analysisStatusIsLoading: false,
      depositsIsLoading: false,
      depositsErrorCode: null,
      totalCount: 3,
    }),
    "ready",
  );
});