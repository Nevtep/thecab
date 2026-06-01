# Contract: Engine V2 Commands And Tooling

## Existing Commands To Preserve

From `apps/web/package.json`:

- `pnpm typecheck`
- `pnpm test:unit`
- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:push`
- `pnpm db:purge`
- `pnpm trigger:dev`
- `pnpm trigger:deploy`
- `pnpm i18n:check`
- `pnpm ds:check`

## New/Updated Commands

### `pnpm analysis:v2:run`

Purpose: Start an Engine V2 run for a wallet/chain from local/dev.

Expected implementation:

```text
tsx src/server/scripts/analysis-engine-v2-run.ts
```

Inputs through env/flags:

- `WALLET_ADDRESS`
- `CHAIN_ID=8453`
- `ANALYSIS_MODE=fresh|incremental|reanalysis|fixture`

### `pnpm analysis:v2:regression`

Purpose: Run deterministic fixture regression for Engine V2.

Expected implementation:

```text
tsx src/server/scripts/analysis-engine-v2-regression.ts
```

Requirements:

- Load fixture pages from `docs/api-research/moralis`.
- Use persisted/research ABI fixtures where live providers are disabled.
- Assert canonicalization, classification families, enrichment gaps, accounting, and read-model materialization.

### `pnpm db:purge`

Purpose: Existing purge command should be extended or documented to support Engine V2 clean-slate validation.

Required safety:

- local/dev only by default;
- explicit confirmation/env flag;
- never implicitly drops production data;
- may support wallet/chain scoped analysis purge;
- may support full analysis-table purge for local DB rebuild.

Suggested flags:

```text
--scope engine-v2
--wallet 0x...
--chain 8453
--confirm-local-dev
```

## Trigger Deployment

### `pnpm trigger:dev`

Must discover `engine-v2-*.task.ts` under `apps/web/src/server/trigger/tasks`.

### `pnpm trigger:deploy`

Must deploy Engine V2 tasks after task files are added and `trigger.config.ts` discovery is verified.

## Validation Commands

Minimum expected validation after implementation:

```text
pnpm db:migrate
pnpm typecheck
pnpm test:unit
pnpm analysis:v2:regression
pnpm i18n:check
pnpm ds:check
```

No browser automation is required or allowed as a feature gate.
