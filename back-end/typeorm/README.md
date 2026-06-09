# TypeORM & Database Migrations

This directory contains the TypeORM data-source configuration, migration files, and migration tests.

## Directory structure

```
typeorm/
├── data-source.ts        # TypeORM DataSource config (used by migrations)
├── migrations/           # Generated migration files (run in timestamp order)
├── test/
│   └── migrations/
│       ├── idempotency.test.ts   # Verifies migrations run without error
│       └── schema-sync.test.ts   # Verifies no drift between entities and DB
└── MIGRATION_CHECKLIST.md
```

Entities live in `libs/common/src/database/entities/`.

## Making a database change

### Prerequisites

Docker must be running. The migration generator and tests use [Testcontainers](https://testcontainers.com/) to spin up ephemeral Postgres instances — no real database connection required.

### Step 1 — Edit entities

Modify or add entity files in `libs/common/src/database/entities/`. Entity files follow the `*.entity.ts` naming convention.

### Step 2 — Generate the migration

Run from the `back-end/` root:

```bash
pnpm migration:generate <PascalCaseName>
```

Example: `pnpm migration:generate AddTransactionStatus`

This script (`scripts/generate-migration.ts`):
1. Starts a temporary Postgres container
2. Runs all existing migrations against it
3. Diffs the migrated schema against your current entities
4. Writes a new timestamped migration file to `typeorm/migrations/`

If the output says "No schema changes detected", your entity changes don't differ from what the existing migrations already produce — check that your edits were saved.

**Always review the generated file** before committing. TypeORM occasionally emits unsafe or redundant queries. A common example: when changing a column's type or length, TypeORM may generate a `DROP COLUMN` + `ADD COLUMN` pair instead of a safe `ALTER COLUMN ... TYPE`. The DROP+ADD approach destroys all existing data in that column. The correct SQL for a type/length change that preserves data is:

```sql
ALTER TABLE "table_name" ALTER COLUMN "column_name" TYPE character varying(100);
```

Other things to watch for: re-creating indexes that already exist, unnecessary constraint drops/re-adds, or column renames being expressed as drop+add.

### Step 3 — Run migration tests

```bash
pnpm test:migrations
```

This runs two test suites, each using their own ephemeral Postgres container:

- **`idempotency.test.ts`** — runs all migrations and verifies they complete without error; runs them a second time to confirm idempotency
- **`schema-sync.test.ts`** — after running all migrations, checks that TypeORM's schema builder reports zero pending changes (no drift between entities and the migrated DB)

Both tests must pass before the migration is ready to merge.

### Step 4 — Pre-merge checklist

See [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md). The key step beyond the automated tests is verifying on a dev environment with **real existing data** that the migration runs cleanly and causes no data loss.

## Other useful commands

| Command | Description |
|---|---|
| `pnpm migration:generate <Name>` | Auto-generate migration from entity diff |
| `pnpm migration:create <path/Name>` | Create an empty migration file for manual SQL |
| `pnpm migration:run` | Run pending migrations against the configured DB |
| `pnpm migration:revert` | Revert the most recently applied migration |
| `pnpm test:migrations` | Run idempotency + schema-sync tests |

## Manual migrations

For changes that can't be auto-generated (data backfills, renaming columns, etc.), use:

```bash
pnpm migration:create typeorm/migrations/<PascalCaseName>
```

This creates an empty migration file with `up()` and `down()` stubs. Implement the SQL manually using `queryRunner.query(...)`. Make sure to implement `down()` so `migration:revert` works correctly.

## Environment variables

The `data-source.ts` config reads from environment variables. For local use, copy `typeorm/example.env` to `typeorm/.env`:

```
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres
NODE_ENV=development
```

These are only needed when running `migration:run` or `migration:revert` against a real database. The generate script and tests manage their own containers.
