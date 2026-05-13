# Phase 0 Local Postgres Runbook

## Safety first

1. Confirm this is a local development database only.
2. Back up before any destructive action.

## Backup

```bash
pg_dump -U user -d thecab > ./backups/thecab_$(date +%Y%m%d_%H%M%S).sql
```

## Wipe and recreate (selected default path)

```bash
dropdb thecab
createdb thecab
```

## Apply baseline migrations

From [apps/web/package.json](apps/web/package.json):

```bash
cd apps/web
pnpm db:generate
pnpm db:migrate
```

## Smoke checks

```bash
pnpm provider:smoke
curl -s http://localhost:3000/api/health
```

## Optional restore

```bash
psql -U user -d thecab < ./backups/<backup-file>.sql
```

## Notes

- Keep this runbook local/dev only.
- Production reset is out of scope and requires a separate controlled process.
