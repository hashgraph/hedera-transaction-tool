# Hedera Transaction Tool Automation

This folder contains automated test tooling for Hedera Transaction Tool:

- Playwright functional end-to-end tests (`tests/**/*.test.ts`)
- Playwright UI performance tests (`tests/ui-performance`)
- k6 API/load test scripts (`k6/`)

## Prerequisites

- Node.js `22.12.0`
- `pnpm`
- One of:
  - a built Hedera Transaction Tool executable (launch mode), or
  - a running front-end Electron app with remote debugging enabled (attach mode)

## Setup

1. Clone the repository.
2. Go to the automation folder:

   ```bash
   cd hedera-transaction-tool/automation
   ```

3. Install dependencies:

   ```bash
   pnpm install
   pnpm approve-builds # only if pnpm requests approval
   ```

4. Create your env file:

   ```bash
   cp example.env .env
   ```

## Environment Configuration

Launch mode example:

```env
ELECTRON_APP_MODE='launch'
EXECUTABLE_PATH='/Applications/Hedera Transaction Tool.app/Contents/MacOS/Hedera Transaction Tool'
PLAYWRIGHT_TEST=true
PLAYWRIGHT_WORKERS=2
PLAYWRIGHT_SHARED_ENV=true

PRIVATE_KEY= # hex encoded
OPERATOR_KEY= # DER encoded
ENVIRONMENT='LOCALNET'

ORGANIZATION_URL='https://localhost:3001'

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=postgres
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=postgres
```

Attach mode example:

```env
ELECTRON_APP_MODE='attach'
ELECTRON_ATTACH_URL='http://127.0.0.1:9222'
ELECTRON_REMOTE_DEBUGGING_PORT='9222'
ELECTRON_ATTACH_TIMEOUT_MS='30000'
```

If you use attach mode, start the front-end first from `front-end/`:

```bash
PLAYWRIGHT_TEST=true ELECTRON_REMOTE_DEBUGGING_PORT=9222 pnpm dev
```

`ENVIRONMENT` can be `LOCALNET`, `TESTNET`, or `PREVIEWNET`.

- `TESTNET` / `PREVIEWNET`: use ECDSA keys
- `LOCALNET`: use ED25519 keys

## Running Playwright Tests

Run all Playwright tests:

```bash
pnpm test
```

List all discovered tests:

```bash
pnpm test:list
```

Run all tests without the TypeScript pre-step:

```bash
pnpm exec playwright test
```

Run the shared E2E buckets by tag:

```bash
pnpm exec playwright test --grep '@local-transactions|@organization-basic|@organization-advanced'
```

Run a single suite:

```bash
pnpm exec playwright test tests/local-basic/registrationTests.test.ts
```

Run all UI performance tests:

```bash
pnpm exec playwright test tests/ui-performance
```

Open the Playwright HTML report:

```bash
pnpm report:playwright
```

## Parallelism Model

`PLAYWRIGHT_WORKERS` controls how many Playwright worker processes can run at once.

- Parallelism is file-level, not free-for-all test-level parallelism.
- `fullyParallel` is disabled in `playwright.config.ts`, so tests inside a single file still run sequentially.
- Splitting large suites into smaller files improves worker utilization because different files can be scheduled on different workers.
- In shared environment mode, workers share the same `solo` and back-end deployment, while Electron/app state stays isolated per worker.

## Functional Test Suites

`@local-basic`

- `tests/local-basic/registrationTests.test.ts`
- `tests/local-basic/loginTests.test.ts`
- `tests/local-basic/settingsTests.test.ts`

`@local-transactions`

- `tests/local-transactions/transactionTests.test.ts`
- `tests/local-transactions/transactionDraftTests.test.ts`
- `tests/local-transactions/workflowTests.test.ts`
- `tests/local-transactions/workflowHistoryDetailsTests.test.ts`
- `tests/local-transactions/groupTransactionTests.test.ts`

`@organization-basic`

- `tests/organization-basic/organizationSettingsTests.test.ts`
- `tests/organization-basic/organizationContactListTests.test.ts`
- `tests/organization-basic/organizationNotificationTests.test.ts`

`@organization-advanced`

- `tests/organization-advanced/organizationTransactionTests.test.ts`
- `tests/organization-advanced/organizationTransactionObserverTests.test.ts`
- `tests/organization-advanced/organizationTransactionExecutionTests.test.ts`
- `tests/organization-advanced/organizationTransactionCompatibilityTests.test.ts`
- `tests/organization-advanced/organizationGroupTests.test.ts`
- `tests/organization-advanced/organizationRegressionTests.test.ts`

Some organization suites are currently marked `skip` in the source, but they remain listed here because they still belong to the suite structure and CI tag layout.

## UI Performance and k6

- UI performance tests are documented in `tests/ui-performance/README.md`.
- k6 scripts are under `k6/` and can be run with `pnpm k6:*` scripts from `package.json` (for example `pnpm k6:smoke`).
