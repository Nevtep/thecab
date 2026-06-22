import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultDepositsListUrlState,
  normalizeFiltersForQueryKey,
  parseDepositsListUrlState,
  serializeDepositsListUrlState,
} from "@/features/deposits/deposits.urlState";

test("createDefaultDepositsListUrlState uses the expected defaults", () => {
  assert.deepEqual(createDefaultDepositsListUrlState(), {
    status: "all",
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

test("parse and serialize deposits URL state round-trip pool, date, return sign, and selection", () => {
  const parsed = parseDepositsListUrlState(new URLSearchParams(
    "status=open_active&pool=8453%3A0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1&from=2026-01-01&to=2026-05-28&returnSign=positive&sort=return_asc&page=2&pageSize=50&selectedDepositId=8453%3A0x827922686190790b37229fd06084350e74485b72%3A71663333",
  ));

  assert.deepEqual(parsed, {
    status: "open_active",
    poolId: "8453:0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1",
    startDayUtc: "2026-01-01",
    endDayUtc: "2026-05-28",
    returnSign: "positive",
    sort: "totalReturn",
    direction: "asc",
    page: 2,
    pageSize: 50,
    selectedDepositId: "8453:0x827922686190790b37229fd06084350e74485b72:71663333",
  });

  assert.equal(
    serializeDepositsListUrlState(parsed),
    "status=open_active&pool=8453%3A0x70acdf2ad0bf2402c957154f944c19ef4e1cbae1&from=2026-01-01&to=2026-05-28&returnSign=positive&sort=return_asc&page=2&pageSize=50&selectedDepositId=8453%3A0x827922686190790b37229fd06084350e74485b72%3A71663333",
  );
});

test("parseDepositsListUrlState ignores view-preference params and invalid values", () => {
  const parsed = parseDepositsListUrlState(new URLSearchParams(
    "status=closed&columns=pool,status&density=compact&pool=bad%2Fpool&from=bad-date&to=2026-05-28&page=-1&pageSize=1000",
  ));

  assert.deepEqual(parsed, {
    status: "closed",
    poolId: null,
    startDayUtc: null,
    endDayUtc: "2026-05-28",
    returnSign: "all",
    sort: "openedAt",
    direction: "desc",
    page: 1,
    pageSize: 25,
    selectedDepositId: null,
  });
});

test("parseDepositsListUrlState accepts legacy params and any return-sign alias", () => {
  const parsed = parseDepositsListUrlState(new URLSearchParams(
    "poolId=123e4567-e89b-12d3-a456-426614174000&startDayUtc=2026-01-01&endDayUtc=2026-05-28&returnSign=any&sort=openedAt&direction=asc",
  ));

  assert.deepEqual(parsed, {
    status: "all",
    poolId: "123e4567-e89b-12d3-a456-426614174000",
    startDayUtc: "2026-01-01",
    endDayUtc: "2026-05-28",
    returnSign: "all",
    sort: "openedAt",
    direction: "asc",
    page: 1,
    pageSize: 25,
    selectedDepositId: null,
  });
});

test("normalizeFiltersForQueryKey excludes detail selection from the list query identity", () => {
  const filters = normalizeFiltersForQueryKey({
    status: "open_active",
    poolId: "123e4567-e89b-12d3-a456-426614174000",
    startDayUtc: "2026-01-01",
    endDayUtc: "2026-05-28",
    returnSign: "positive",
    sort: "totalReturn",
    direction: "asc",
    page: 2,
    pageSize: 50,
    selectedDepositId: "123e4567-e89b-12d3-a456-426614174111",
  });

  assert.deepEqual(filters, {
    status: "open_active",
    poolId: "123e4567-e89b-12d3-a456-426614174000",
    startDayUtc: "2026-01-01",
    endDayUtc: "2026-05-28",
    returnSign: "positive",
    sort: "totalReturn",
    direction: "asc",
    page: 2,
    pageSize: 50,
  });
});
