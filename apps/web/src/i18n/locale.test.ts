import assert from "node:assert/strict";
import test from "node:test";

import { formatDateTime, formatRelativeTime } from "@/i18n/formatters";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/locale";

test("normalizeLocale resolves supported locales and falls back to English", () => {
  assert.equal(normalizeLocale(undefined), DEFAULT_LOCALE);
  assert.equal(normalizeLocale("es-AR"), "es");
  assert.equal(normalizeLocale("en-US"), "en");
  assert.equal(normalizeLocale("fr-FR"), DEFAULT_LOCALE);
});

test("formatDateTime returns localized non-empty output for Settings timestamps", () => {
  const isoValue = "2026-05-24T18:30:00.000Z";
  const english = formatDateTime(isoValue, "en");
  const spanish = formatDateTime(isoValue, "es");

  assert.ok(english.length > 0);
  assert.ok(spanish.length > 0);
  assert.notEqual(english, spanish);
});

test("formatRelativeTime uses locale-aware relative labels for Settings freshness copy", () => {
  const originalNow = Date.now;

  Date.now = () => new Date("2026-05-24T12:00:00.000Z").getTime();

  try {
    const english = formatRelativeTime("2026-05-24T14:00:00.000Z", "en");
    const spanish = formatRelativeTime("2026-05-24T14:00:00.000Z", "es");

    assert.match(english, /2|hour|in/i);
    assert.match(spanish, /2|hora|dentro/i);
    assert.notEqual(english, spanish);
  } finally {
    Date.now = originalNow;
  }
});