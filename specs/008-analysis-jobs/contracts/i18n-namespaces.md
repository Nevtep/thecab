# Contract: i18n Namespaces (008-analysis-jobs)

**Feature**: `008-analysis-jobs`  
**Date**: 2026-05-24  
**Scope**: All user-facing strings that surface analysis state in the UI. The engine returns machine codes only; the browser resolves text through i18next using these namespaces. Citations: `spec.md` FR-054..FR-058, constitution Principle II, `scripts/check-i18n-parity.ts`.

## Rules

1. **Three new namespaces**: `analysis`, `coverage`, `errors`. Each lives at `apps/web/src/i18n/locales/{en,es}/{namespace}.json`.
2. **English + Spanish parity** is enforced by `pnpm i18n:check`. Every key MUST exist in both locales.
3. **Machine codes never leak**: the engine returns codes (`pricingPartial`, `run_already_in_progress`, …) and the UI looks them up via these namespaces. No hardcoded English in `.tsx` files (CA-002).
4. **Brand consistency** (Principle I): Spanish copy follows `docs/the-cab-copy-guidelines-landing-content-es.md` voice — formal usted, control-tower tone, no casino/meme language.
5. **No interpolation in machine codes**: variables (wallet address suffix, slice index, day counts) are passed via i18next `{{var}}` placeholders, not concatenated into the code.

## Namespace: `analysis`

User-facing labels for canonical status, phases, slices, and the analysis CTA. Consumed by Settings (007), Overview, and the run-status banner.

### Required key skeleton

```jsonc
// en/analysis.json
{
  "status": {
    "not_analyzed": "Not analyzed yet",
    "queued":       "Queued",
    "running":      "Analyzing…",
    "ready":        "Up to date",
    "stale":        "Refresh available",
    "failed":       "Analysis failed"
  },
  "mode": {
    "full_history": "Full history",
    "incremental":  "Incremental update"
  },
  "phase": {
    "deposits":  "Deposits",
    "rewards":   "Rewards",
    "activity":  "Activity classification",
    "pools":     "Pool metadata",
    "finalize":  "Performance series"
  },
  "phaseStatus": {
    "queued":    "Pending",
    "running":   "Running",
    "complete":  "Complete",
    "failed":    "Failed"
  },
  "slice": {
    "label":         "Slice {{index}}",
    "rangeLabel":    "{{start}} → {{end}}",
    "progress":      "{{processed}} of {{seen}} transactions",
    "skippedCached": "Already covered (cached)"
  },
  "cta": {
    "start":         "Analyze wallet",
    "startAgain":    "Refresh analysis",
    "cancel":        "Cancel analysis",
    "viewProgress":  "View progress"
  },
  "banner": {
    "queued":   "We will start your analysis shortly.",
    "running":  "Analyzing your wallet on {{chain}}. This usually takes a few minutes.",
    "ready":    "Last analyzed {{relative}}.",
    "stale":    "Last analyzed {{relative}}. A refresh is available.",
    "failed":   "We couldn't finish your last analysis. You can try again."
  },
  "lastSuccessful": {
    "never":   "Never",
    "atUtc":   "{{datetime}} UTC"
  }
}
```

### Spanish (`es/analysis.json`) — voice notes

- `status.ready` → "Al día"
- `status.stale` → "Actualización disponible"
- `status.failed` → "El análisis falló"
- `cta.start` → "Analizar billetera"
- `banner.running` → "Analizando su billetera en {{chain}}. Suele tardar unos minutos."

Full Spanish translations land with implementation; this skeleton documents the required keys.

---

## Namespace: `coverage`

User-facing labels for the controlled coverage-reason vocabulary (FR-031). Used by the run-status banner, slice detail rows, and Settings diagnostics.

### Required key skeleton

```jsonc
// en/coverage.json
{
  "level": {
    "full":    "Full coverage",
    "partial": "Partial coverage",
    "unknown": "Coverage unknown"
  },
  "reason": {
    "missingPrices":      "Some token prices were unavailable.",
    "partialDecoded":     "Some on-chain events couldn't be decoded.",
    "providerError":      "A data provider returned an error.",
    "providerThrottled":  "A data provider was rate-limited.",
    "reorgSuspect":       "Some recent blocks are still settling.",
    "decodeError":        "An on-chain event failed to decode.",
    "pricingPartial":     "Some prices used a lower-confidence fallback.",
    "unknownError":       "An unknown issue affected this run."
  },
  "reasonShort": {
    "missingPrices":     "Missing prices",
    "partialDecoded":    "Partial decode",
    "providerError":     "Provider error",
    "providerThrottled": "Provider throttled",
    "reorgSuspect":      "Recent blocks settling",
    "decodeError":       "Decode error",
    "pricingPartial":    "Price fallback used",
    "unknownError":      "Unknown issue"
  },
  "priceSymbolFallback": "Price resolved by symbol (lower confidence)."
}
```

### Spanish (`es/coverage.json`) — voice notes

- `level.full` → "Cobertura completa"
- `level.partial` → "Cobertura parcial"
- `reason.missingPrices` → "Algunos precios de tokens no estuvieron disponibles."
- `reason.providerThrottled` → "Un proveedor de datos limitó la velocidad de las solicitudes."

---

## Namespace: `errors`

User-facing envelopes for engine API error codes returned by `contracts/analysis-api.md`. Errors are looked up by `error.code`.

### Required key skeleton

```jsonc
// en/errors.json
{
  "analysis": {
    "invalid_payload":          "The request was invalid.",
    "unsupported_chain":        "This chain isn't supported yet.",
    "unsupported_mode":         "That analysis mode isn't supported.",
    "unauthorized":             "Please connect your wallet to continue.",
    "wallet_mismatch":          "This wallet doesn't match your connected session.",
    "run_already_in_progress":  "An analysis is already running for this wallet.",
    "run_not_found":            "We couldn't find that analysis run.",
    "not_cancellable":          "That run can't be cancelled.",
    "internal_error":           "Something went wrong. Please try again."
  }
}
```

### Spanish (`es/errors.json`) — voice notes

- `analysis.unauthorized` → "Conecte su billetera para continuar."
- `analysis.wallet_mismatch` → "Esta billetera no coincide con su sesión conectada."
- `analysis.run_already_in_progress` → "Ya hay un análisis en curso para esta billetera."
- `analysis.internal_error` → "Ocurrió un problema. Inténtelo de nuevo."

---

## Forbidden Patterns

- ❌ Hardcoded English strings in `.tsx` for any phase/status/coverage/error label.
- ❌ String concatenation like `` `Last analyzed ${minutes}m ago` `` — use `{{relative}}` interpolation.
- ❌ Returning translated strings from any `/api/analysis/*` route.
- ❌ Adding ad-hoc coverage-reason codes outside the fixed set in §coverage.reason.
- ❌ Mixing namespaces (e.g. putting an error label under `analysis.*`).

## Parity Enforcement

`pnpm i18n:check` (`apps/web/scripts/check-i18n-parity.ts`) runs in CI and fails on any missing key in either locale. Implementation tasks MUST add the three namespaces to its watch list if not already covered by a glob.

## Audit Checklist

- [ ] `apps/web/src/i18n/locales/en/analysis.json` exists with all keys above.
- [ ] `apps/web/src/i18n/locales/es/analysis.json` exists with all keys above.
- [ ] Same for `coverage.json` and `errors.json`.
- [ ] No `.tsx` file in `apps/web/src/features/**` contains a hardcoded English status/phase/coverage label.
- [ ] `pnpm i18n:check` passes after implementation.
