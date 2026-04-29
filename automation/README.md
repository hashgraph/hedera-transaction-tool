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
DATABASE_DEBUG='false'
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

`DATABASE_DEBUG` defaults to off and should stay `false` for normal runs. CI ignores this flag and keeps DB debug logging disabled. Set `DATABASE_DEBUG=true` only for local automation debugging when you need SQL connection/query logging. Query parameters are redacted in that debug output.

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

## Test Suites and Tags

Each functional test file carries exactly one suite tag in its `test.describe(...)` title. The tag determines what backend infrastructure the test expects and which CI job picks it up. Pick the tag that matches the *minimum* infrastructure your test actually needs — the lighter the suite, the faster the CI job.

| Tag                      | Solo (Hedera localnet) | Org back-end + Postgres | Typical use                                                                                               |
| ------------------------ | ---------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `@local-basic`           | No                     | No                      | Pure UI flows: login, registration, settings panels, form validation that doesn't need ledger lookups     |
| `@local-transactions`    | Yes                    | No                      | Personal-mode transactions executed against the local Hedera node, mirror-node lookups, account/file CRUD |
| `@organization-basic`    | Yes                    | Yes                     | Single-user org flows: contact list, settings inside an org, notifications panel                          |
| `@organization-advanced` | Yes                    | Yes                     | Multi-user / multi-signer org flows: group transactions, signing lifecycles, council-scale regression     |

### How to choose a tag for a new test

- **Need a logged-in user only?** Use `@local-basic`. Tests there cannot rely on mirror-node lookups (no live network) but can poke the renderer's Pinia stores via test hooks (see `tests/helpers/support/localOrganizationConnectionSupport.ts` for examples).
- **Need to actually execute a transaction or read mirror data?** Use `@local-transactions`.
- **Need a connected organization (e.g., the Notifications settings tab, contact list, signing flows)?** Use `@organization-basic` for single-user scenarios, `@organization-advanced` when the test creates additional org users / multi-signer accounts.

The faster the suite, the cheaper your test is to run on every PR. A test that only needs to assert a button is disabled doesn't belong in `@organization-advanced`.

### Test files

`@local-basic`
- `accountResetTests.test.ts`
- `loginTests.test.ts`
- `registrationAccountSetupTests.test.ts`
- `registrationPersistenceTests.test.ts`
- `registrationTests.test.ts`
- `settingsGeneralTests.test.ts`
- `settingsKeysImportTests.test.ts`
- `settingsKeysManagementTests.test.ts`
- `settingsKeysTests.test.ts`
- `settingsOrganizationsTabTests.test.ts`
- `settingsProfileTests.test.ts`
- `transactionAllowanceValidationTests.test.ts`
- `transactionComplexKeyValidationTests.test.ts`
- `transactionFileIdValidationTests.test.ts`
- `transactionHeaderValidationTests.test.ts`
- `transactionTransferValidationTests.test.ts`

`@local-transactions`
- `groupTransactionExecutionTests.test.ts`
- `groupTransactionItemTests.test.ts`
- `groupTransactionTests.test.ts`
- `transactionAccountCreateExecutionTests.test.ts`
- `transactionAccountCreateValidationTests.test.ts`
- `transactionAccountDatabaseTests.test.ts`
- `transactionAccountDeleteTests.test.ts`
- `transactionAccountUpdateTests.test.ts`
- `transactionDraftAccountPersistenceTests.test.ts`
- `transactionDraftFileTests.test.ts`
- `transactionDraftKeySafetyTests.test.ts`
- `transactionDraftTests.test.ts`
- `transactionFileTests.test.ts`
- `transactionTransferAllowanceTests.test.ts`
- `workflowFileNavigationTests.test.ts`
- `workflowHistoryDetailsTests.test.ts`
- `workflowHistoryFileBreadcrumbDetailsTests.test.ts`
- `workflowHistoryTransferAllowanceDetailsTests.test.ts`
- `workflowTests.test.ts`

`@organization-basic`
- `organizationContactListAdminTests.test.ts`
- `organizationContactListBulkTests.test.ts`
- `organizationContactListTests.test.ts`
- `organizationLoginTests.test.ts`
- `organizationNotificationTests.test.ts`
- `organizationSettingsConnectionTests.test.ts`
- `organizationSettingsGeneralTests.test.ts`
- `organizationSettingsNotificationsTests.test.ts`
- `organizationSettingsRecoveryTests.test.ts`
- `organizationSettingsTransactionAccessTests.test.ts`

`@organization-advanced`
- `organizationGroupCsvLoadTests.test.ts`
- `organizationGroupTests.test.ts`
- `organizationRegressionTests.test.ts`
- `organizationTransactionCompatibilityTests.test.ts`
- `organizationTransactionExecutionTests.test.ts`
- `organizationTransactionLifecycleTests.test.ts`
- `organizationTransactionObserverTests.test.ts`
- `organizationTransactionTests.test.ts`

Some organization suites are currently marked `skip` in the source, but they remain listed here because they still belong to the suite structure and CI tag layout.

## CI layout

`.github/workflows/test-frontend.yaml` runs two Playwright matrix entries:

| CI job      | Tag(s)                                                                 | `PLAYWRIGHT_WORKERS` | Infrastructure             |
| ----------- | ---------------------------------------------------------------------- | -------------------- | -------------------------- |
| Local Basic | `@local-basic`                                                         | 2                    | Headless Electron only     |
| Shared E2E  | `@local-transactions`, `@organization-basic`, `@organization-advanced` | 8                    | Solo + back-end + Postgres |

`PLAYWRIGHT_SHARED_ENV: true` is set on the Shared E2E job so per-worker isolation (`TEST_WORKER_INDEX`, partition, user-data dir, remote debugging port) is wired correctly.

## Parallelism Model

### Default: file-level parallelism

`PLAYWRIGHT_WORKERS` controls how many Playwright worker processes can run at once.

- `fullyParallel: false` in `playwright.config.ts` — tests inside a single file run sequentially within one worker.
- Workers are scheduled at the **file** level: different files can run on different workers, but every test in the same file shares one worker process (one Electron app, one suite `beforeAll`).
- `.env` is loaded at config time (top of `playwright.config.ts`), so `PLAYWRIGHT_WORKERS=2` in `.env` is honored locally without inline shell exports.
- Splitting a large file into smaller files is the simplest way to improve worker utilization — each new file becomes its own scheduling unit.

### Per-describe parallelism: `test.describe.configure({ mode: 'parallel' })`

For long files where the per-test runtime dominates over the per-worker bootstrap (Electron launch + suite setup), you can opt a single describe into test-level parallelism:

```ts
test.describe('Organization Transaction status/signing lifecycle tests @organization-advanced', () => {
  test.describe.configure({ mode: 'parallel' });
  // ...
});
```

What this does:

- Tests inside the describe become independent scheduling units; multiple workers can pull from the same file simultaneously.
- Each worker still runs its own `beforeAll` — bootstrap is per-worker, not per-test. If two workers run two tests from the same file, you pay bootstrap twice.
- Module-level `let` state in the test file is **per-worker** (each worker is a separate Node process), so it does not bleed between parallel tests.

When it pays off:

- A single test takes minutes (signing + ledger waits) → overlapping tests on different workers shrinks the file's wall-clock to roughly `max(single test) + bootstrap`.
- Tests inside the describe are genuinely independent — no shared state mutated by one test that another reads.

When it breaks:

- Tests share fixtures across the describe (e.g., a complex-key account created in `beforeAll`, or a cached file ID built by the first test and reused by later tests). Concurrent execution will see partial state and fail intermittently.
- Backend rate-limiters or single-instance constraints serialize the workers anyway, so the gain is eaten by waiting.

Roll out one file at a time, watch the CI report, and if a flake appears revert the configure line.

### What goes where: shared environment

In shared environment mode (`PLAYWRIGHT_SHARED_ENV=true`):

- Workers share the same Solo cluster and back-end deployment.
- Electron user-data dirs, session partitions, and remote debugging ports are isolated per `TEST_WORKER_INDEX` (see `utils/setup/playwrightIsolation.ts`).
- Org nicknames are uniquified per test via `resolveOrganizationNickname(testInfo.title)` in the advanced suite hooks, so org-advanced tests can run concurrently against the same backend without colliding.

## Reports and worker utilization

Playwright writes three reporters in parallel:

- HTML report → `reports/playwright/` (open with `pnpm report:playwright`).
- JSON report → `reports/playwright-json/results.json` (sibling folder so the HTML reporter's cleanup step doesn't wipe it).
- `list` (console) and `github` annotations on CI.

Both report folders are uploaded as the `playwright-report-<suite-name>` artifact in CI.

To see per-worker utilization (find the long-pole worker, spot idle workers):

```bash
jq -r '
  [.. | objects | select(.results?[0].workerIndex != null)
    | { worker: .results[0].workerIndex, dur: .results[0].duration, title: .title }]
  | group_by(.worker)
  | map({ worker: .[0].worker, total_min: ((map(.dur) | add) / 60000 | floor), tests: length })
  | sort_by(.worker)
' reports/playwright-json/results.json
```

For the slowest 15 tests with which worker ran each:

```bash
jq -r '
  [.. | objects | select(.results?[0].workerIndex != null)
    | { worker: .results[0].workerIndex, dur_min: (.results[0].duration / 60000), title: .title }]
  | sort_by(-.dur_min)
  | .[0:15]
' reports/playwright-json/results.json
```

## Page objects and helpers

- `pages/` — page-object classes (`SettingsPage`, `TransactionPage`, `OrganizationPage`, etc.). Tests should not contain raw selectors or DOM CSS strings; add a selector + helper here instead.
- `tests/helpers/bootstrap/` — per-suite app launch/teardown (`setupLocalSuiteApp`, `setupOrganizationSuiteApp`, `registerOrganizationAdvancedSuiteHooks`).
- `tests/helpers/fixtures/` — reusable test fixtures (org settings suite, group transaction suite, etc.).
- `tests/helpers/support/` — small renderer-state helpers (e.g., poking Pinia stores or `window.__testHooks__` for state that isn't exposed via the UI).

A test-only escape hatch lives at `window.__testHooks__` (see `front-end/src/renderer/main.ts`); it exposes module-scoped renderer refs (currently version-state setters) so Playwright can simulate states the UI doesn't otherwise let you reach. Use it sparingly — prefer driving the UI when possible.

## Gotchas worth knowing

- **Error toasts never auto-dismiss.** `ToastManager.error` (in the renderer) is configured with `duration: 0`, so an error toast persists in the DOM until the user clicks it. If your test asserts an error toast and a later test reads `getToastMessageByVariant('error')`, the stale toast can be returned. Either (a) use `waitForToastMessageByVariant(variant, message)` which filters by exact text, or (b) click the toast at the end of your test to dismiss it and `waitFor({ state: 'detached' })` before exiting.
- **Mirror-node-dependent validation in `@local-basic`.** Several form validations (`Sign disabled when payer key not resolved`, `Invalid checksum on Link Existing`, `Insufficient balance`) only surface after a successful mirror-node lookup. They aren't reachable in `@local-basic` (no live mirror) — if you need the toast/inline error, place the test in `@local-transactions`.
- **Drafts modal can intercept clicks.** Most `beforeEach` hooks call `transactionPage.closeDraftModal()` after navigating to Transactions. Skip it and your first click may go to the modal instead of the form.
- **Don't ship `test.only(...)` or `test.describe.only(...)`.** They skip every other test in the file, which silently turns a CI run green while running almost nothing.

## UI Performance and k6

- UI performance tests are documented in `tests/ui-performance/README.md`.
- k6 scripts are under `k6/` and can be run with `pnpm k6:*` scripts from `package.json` (for example `pnpm k6:smoke`).
