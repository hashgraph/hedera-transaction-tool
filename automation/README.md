# Hedera Transaction Tool Tests

This project contains automated tests for the Hedera Transaction Tool, designed to ensure the reliability and
functionality of the application. The tests are written using [Playwright](https://playwright.dev/), a powerful
framework for testing web applications across different browsers.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js: `22.12.0`
- pnpm: `9.15.3`

Additionally, you should either:

- have the Hedera Transaction Tool executable installed and know its path, or
- run the front-end Electron app in dev mode with remote debugging enabled if you want to attach to an existing app
  instance.

Infrastructure requirements depend on the suite you run:

- `@local-basic` needs only the front-end app.
- `@local-transactions`, `@organization-basic`, and `@organization-advanced` also need Solo localnet, the back end,
  and PostgreSQL connection settings.

## Setup

1. **Clone the repository** to your local machine using Git:

   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the project directory**:

   ```bash
   cd hedera-transaction-tool/automation
   ```

3. **Install dependencies** by running:

   ```bash
   pnpm install
   pnpm approve-builds # if required by pnpm install
   ```

4. **Configure the environment variables** by creating a `.env` file in the root of the project.

   Launch mode example:

   ```env
   ELECTRON_APP_MODE='launch'
   EXECUTABLE_PATH='/path/to/Hedera Transaction Tool'
   PLAYWRIGHT_TEST=true
   PLAYWRIGHT_WORKERS=1
   PLAYWRIGHT_SHARED_ENV=false
   PRIVATE_KEY='your_private_key_here'
   ENVIRONMENT='LOCALNET'
   ```

   Attach mode example:

   ```env
   ELECTRON_APP_MODE='attach'
   ELECTRON_ATTACH_URL='http://127.0.0.1:9222'
   PLAYWRIGHT_TEST=true
   PLAYWRIGHT_WORKERS=1
   PLAYWRIGHT_SHARED_ENV=false
   PRIVATE_KEY='your_private_key_here'
   ENVIRONMENT='LOCALNET'
   ```

   If you use attach mode, start the front-end first from `front-end/`:

   ```bash
   PLAYWRIGHT_TEST=true ELECTRON_REMOTE_DEBUGGING_PORT=9222 pnpm dev
   ```

   Replace `ENVIRONMENT` with variable that can be set to `TESTNET`, `PREVIEWNET` or `LOCALNET`.

   Depending on the environment selected:

   - TESTNET: Use your ECDSA private keys.
   - PREVIEWNET: Use your ECDSA private keys.
   - LOCALNET: Use your ED25519 private keys.

   Shared-environment suites also need:

   ```env
   PLAYWRIGHT_SHARED_ENV=true
   PLAYWRIGHT_WORKERS=3
   ORGANIZATION_URL='https://localhost:3001'
   POSTGRES_HOST='localhost'
   POSTGRES_PORT='5432'
   POSTGRES_DATABASE='postgres'
   POSTGRES_USERNAME='postgres'
   POSTGRES_PASSWORD='postgres'
   ```

## Running Tests

Run commands from `automation/`.

To run the whole Playwright suite:

```bash
pnpm test
```

To list discovered tests without running them:

```bash
pnpm run test:list
```

To run a single file:

```bash
pnpm exec playwright test tests/loginTests.test.ts
```

Playwright worker behavior is controlled by `PLAYWRIGHT_WORKERS`. The config keeps `fullyParallel: false`, so tests in
the same file run sequentially while different files can run concurrently across workers. This matches the execution
model described in
[`AUTOMATION_TESTS_PLAIN_TEXT_COMPARISON_refactor_parallel_execution_vs_refactor_hooks_reorganize.md`](../AUTOMATION_TESTS_PLAIN_TEXT_COMPARISON_refactor_parallel_execution_vs_refactor_hooks_reorganize.md).

## How Tests Are Executed

### Local execution

The common local entry point is:

```bash
pnpm exec playwright test
```

Useful local commands that mirror the current suite split are:

```bash
PLAYWRIGHT_SHARED_ENV=false PLAYWRIGHT_WORKERS=1 \
pnpm exec playwright test --grep "@local-basic"
```

```bash
PLAYWRIGHT_SHARED_ENV=true PLAYWRIGHT_WORKERS=3 \
pnpm exec playwright test --grep "@local-transactions|@organization-basic|@organization-advanced"
```

Practical notes:

- `@local-basic` is the lightweight slice and does not require Solo or the back end.
- `@local-transactions`, `@organization-basic`, and `@organization-advanced` are intended to run against a shared
  localnet/back-end environment.
- In launch mode, Playwright starts the executable from `EXECUTABLE_PATH`.
- In attach mode, Playwright connects to the running Electron app through `ELECTRON_ATTACH_URL` or
  `ELECTRON_REMOTE_DEBUGGING_PORT`.
- On Linux without a desktop session, run the command through `xvfb-run -a`, the same way CI does.

### GitHub Actions execution (`.github/workflows/test-frontend.yaml`)

The `Test Frontend` workflow runs the automation tests in two stages:

1. `Build | Front-end` installs front-end dependencies, runs `pnpm run build:linux`, and caches
   `front-end/release/linux-unpacked`.
2. The `Automation` matrix restores that build artifact and runs Playwright in two slices:

| Job name | Grep | Solo required | Back-end required | `PLAYWRIGHT_SHARED_ENV` | `PLAYWRIGHT_WORKERS` |
| --- | --- | --- | --- | --- | --- |
| `Automation | Local Basic` | `@local-basic` | No | No | `false` | `1` |
| `Automation | Shared E2E` | `@local-transactions\|@organization-basic\|@organization-advanced` | Yes | Yes | `true` | `3` |

The CI Playwright command is:

```bash
xvfb-run -a npx playwright test --grep "${{ matrix.test-suite.grep }}"
```

The workflow also injects the main runtime variables used by the tests:

- `EXECUTABLE_PATH=../front-end/release/linux-unpacked/hedera-transaction-tool`
- `ENVIRONMENT=LOCALNET`
- `PLAYWRIGHT_SHARED_ENV`
- `PLAYWRIGHT_WORKERS`
- `ORGANIZATION_URL` and `POSTGRES_*` for the shared E2E slice

For the shared E2E job, the workflow prepares the environment before Playwright starts:

- installs Docker Compose if needed
- installs and deploys Solo
- verifies Solo port forwarding
- builds and starts the back end with Docker Compose
- installs `xvfb` and runtime shared libraries

After the run, CI uploads the Playwright HTML report, raw test results, and Solo diagnostics when applicable.

The same workflow also contains a separate `unit-test` matrix for front-end Vitest suites in `front-end/`. That job
is independent from the Playwright automation described in this README.

## Hooks And Limitations

The current branch follows the `refactor_parallel_execution` hook model described in
[`AUTOMATION_TESTS_PLAIN_TEXT_COMPARISON_refactor_parallel_execution_vs_refactor_hooks_reorganize.md`](../AUTOMATION_TESTS_PLAIN_TEXT_COMPARISON_refactor_parallel_execution_vs_refactor_hooks_reorganize.md).
Most suites use suite-scoped fixtures rather than recreating business data before every test.

### Current hook lifecycle

Typical suite structure in this branch:

- `beforeAll`
  - activates suite isolation when `PLAYWRIGHT_SHARED_ENV=true`
  - resets local SQLite and, for organization suites, back-end state when shared-environment mode is disabled
  - starts or attaches to the Electron app with `setupApp()`
  - creates page objects and seeds the local user or organization session once for the whole file
  - runs one-time environment setup such as transaction bootstrap
- `beforeEach`
  - navigates back to the expected screen
  - closes transient UI state such as draft modals and toasts
  - signs in the active organization user when the suite needs it
- `afterEach`
  - usually performs best-effort organization logout
- `afterAll`
  - calls `closeApp()`; in launch mode this closes the app, and in attach mode it leaves the external app running
  - resets local or back-end state again when allowed by the environment
  - removes worker isolation directories and environment overrides

Important consequence:

- tests in the same file share the data seeded in `beforeAll`
- many top-level suites still declare `test.describe.configure({ mode: 'serial' })`
- Playwright also runs with `fullyParallel: false`, so files are sequential internally and only file-level concurrency
  happens across workers

### CI limitations

CI runs in launch mode and has two different behaviors depending on the job slice:

- `Automation | Local Basic`
  - `PLAYWRIGHT_SHARED_ENV=false`
  - local SQLite reset hooks run before and after the suite
- `Automation | Shared E2E`
  - `PLAYWRIGHT_SHARED_ENV=true`
  - local and back-end reset hooks are intentionally skipped
  - isolation comes from worker namespacing (`PLAYWRIGHT_USER_DATA_DIR`, session partition, labels, remote debugging
    port), not from a globally empty backend

Practical limitations in CI:

- an early failure can skip the rest of the file because many suites still run in serial mode
- because setup is shared at suite scope, one broken test can poison later tests in the same file
- shared E2E jobs cannot assume an empty PostgreSQL/Redis/backend state between files; tests must tolerate
  worker-shared infrastructure
- infra instability has a large blast radius because Solo, the back end, and seeded organization state are usually
  created once in `beforeAll` and then reused

### Local launch mode limitations

Launch mode is the closest option to a fresh automated run because Playwright starts a new Electron process from
`EXECUTABLE_PATH`.

Practical limitations in local launch mode:

- even in launch mode, `setupApp()` clears `localStorage` and `sessionStorage` at startup
- when shared-environment mode is disabled, suite hooks reset local state before and after the suite, so launch mode is
  not suitable for preserving a long-lived manual app state
- because most test data is seeded once in `beforeAll`, debugging often requires rerunning the full file rather than a
  single isolated test path
- mutable page-object state can leak between tests in the same file if a test exits mid-flow

### Local attach mode limitations

Attach mode connects to an already running Electron instance through `ELECTRON_ATTACH_URL` or
`ELECTRON_REMOTE_DEBUGGING_PORT`.

Practical limitations in local attach mode:

- attach mode does not preserve the existing browser session as-is; `setupApp()` still clears browser storage on
  startup
- if automation detects an already logged-in session, it calls `resetAppState()`, so attach mode still trends toward a
  clean automation session rather than “continue exactly where I left off”
- `closeApp()` does not stop the attached app, so leftover state remains in that Electron instance after the suite
- one Playwright process should own one attached Electron instance and one CDP endpoint; sharing a single attached app
  across multiple Playwright processes is unsafe
- with suite-scoped hooks, an early failure in `beforeAll` or the first test can leave the attached app in a mutated
  state for the rest of the suite

Recommended local usage:

- use launch mode when you want reproducible automation behavior
- use attach mode when you need interactive debugging, but start from a disposable app instance and avoid sharing that
  instance across concurrent runs

## Current Test Groups

- `@local-basic`
  - `registrationTests.test.ts`
  - `loginTests.test.ts`
  - `settingsTests.test.ts`
- `@local-transactions`
  - `transactionTests.test.ts`
  - `workflowTests.test.ts`
  - `groupTransactionTests.test.ts`
- `@organization-basic`
  - `organizationSettingsTests.test.ts`
  - `organizationContactListTests.test.ts`
  - `organizationNotificationTests.test.ts` (currently skipped)
- `@organization-advanced`
  - `organizationTransactionTests.test.ts`
  - `organizationGroupTests.test.ts`
  - `organizationRegressionTests.test.ts` (currently skipped)

Examples:

```bash
pnpm exec playwright test tests/registrationTests.test.ts
```

```bash
pnpm exec playwright test --grep "@organization-advanced"
```
