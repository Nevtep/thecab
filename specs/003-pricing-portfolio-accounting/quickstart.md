# Quickstart: Pricing and Portfolio Accounting Engine

## Purpose

This quickstart defines validation scenarios for the first reusable valuation and accounting layer on top of The Cab's canonical ledger.

## Required Environment

Set the minimum environment needed for canonical ledger reconstruction plus pricing and accounting:

- `DATABASE_URL` for PostgreSQL
- `BASE_RPC_URL` for server-side Base RPC access
- `BASE_RPC_FALLBACK_URLS` for optional server-side fallback RPCs
- `BASE_TRACE_RPC_URL` for optional trace-capable fallback access
- `NEXT_PUBLIC_BASE_RPC_URL` for the client wallet runtime transport
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` for WalletConnect-compatible browser connectivity
- `PRICE_PROVIDER_API_KEY` for the configured external price provider, if required by the deployment environment

## Local Startup

1. Apply database migrations with `pnpm db:migrate`.
2. Start the app with `pnpm dev`.
3. Reconstruct a wallet session with accepted canonical ledger output.
4. Open the session-backed ledger flow for that wallet.

## Validation Scenario 1: Current Total Portfolio Value

1. Reconstruct a wallet that has supported in-scope Aerodrome or supported Mellow activity plus current price coverage.
2. Open the accounting read model for the accepted session.

Expected results:

- The system returns a current total portfolio value in USD/USDC-normalized terms.
- The total reflects the latest accepted canonical ledger plus current price inputs rather than raw chain data.
- The output includes an explicit `asOf` or equivalent current-valuation reference time.

## Validation Scenario 2: Capital Entered And Capital Withdrawn

1. Use a wallet fixture or replay scenario with one or more external deposits and one or more external withdrawals.
2. Generate the accounting snapshot.

Expected results:

- External deposits appear under capital entered.
- External withdrawals appear under capital withdrawn.
- Deposit and withdrawal amounts do not appear as pure profit or loss.
- Any embedded gains or losses crystallized by disposal remain separated from the principal flow itself.

## Validation Scenario 3: Realized And Unrealized PnL

1. Use a wallet with both closed or reduced exposure and still-open holdings.
2. Generate accounting outputs at portfolio and pool level.

Expected results:

- Realized PnL is produced for crystallized outcomes.
- Unrealized PnL is produced for still-open exposure and held assets.
- Realized plus unrealized PnL remains consistent with current value and capital-flow reconciliation.

## Validation Scenario 4: Idle Balance Inclusion

1. Use a wallet with residual or idle balances outside active positions.
2. Generate current accounting outputs.

Expected results:

- Idle or unallocated balances remain visible in the accounting output.
- Priced idle balances contribute to total current portfolio value.
- Idle balances are not forced into synthetic pools when attribution is not confident.

## Validation Scenario 5: Pool And Strategy Accounting

1. Use a wallet that has multiple pools and, within at least one pool, both manual and supported Mellow activity.
2. Generate accounting outputs.

Expected results:

- Pool-level value and PnL are available.
- Manual and supported Mellow strategy accounting remains separated inside the same pool.
- Pool totals reconcile from the underlying strategy summaries.

## Validation Scenario 6: Position Accounting Precision

1. Use one case with reliable canonical position continuity and one case where exact position-level continuity is not sufficiently trustworthy.
2. Generate detailed accounting outputs.

Expected results:

- Reliable position instances receive position-level accounting output.
- Cases without reliable continuity roll up to the nearest trustworthy scope rather than fabricating exact position values.

## Validation Scenario 7: Partial Price Coverage

1. Use a wallet containing both priced and unpriced supported-or-in-scope components.
2. Generate the accounting snapshot.

Expected results:

- The system publishes totals for the priced portion only.
- Unpriced or excluded portions are disclosed explicitly.
- The output does not silently treat missing prices as zero.
- Coverage or confidence metadata makes the partial nature of the result visible.

## Validation Scenario 8: Explainability And Traceability

1. Select one portfolio total, one pool total, and one strategy or position figure.
2. Drill into the output metadata.

Expected results:

- Each figure can be traced back to canonical ledger records and price inputs.
- The output identifies whether a value came from event-time valuation or current holdings valuation.
- Fallback usage and confidence levels are visible where applicable.

## Automated Validation Targets

- `pnpm test:unit`
- `pnpm test:replay`
- `pnpm test:contract`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm build`

`pnpm validate:quickstart` should continue to cover typecheck, unit, replay, contract, integration, and build validation. Run `pnpm test:e2e` separately for browser coverage if that remains the repository convention.

## Acceptance Threshold

The feature is ready to move to task generation when the implementation demonstrates:

- current total portfolio value in USD/USDC-normalized terms
- capital entered and capital withdrawn that stay separate from pure performance
- realized and unrealized PnL outputs
- inclusion of idle or unallocated balances in total portfolio value
- pool and strategy breakdowns with manual versus supported Mellow separation preserved
- explicit disclosure of partial price coverage and unpriced portions
- traceability from accounting outputs back to canonical ledger records and price inputs