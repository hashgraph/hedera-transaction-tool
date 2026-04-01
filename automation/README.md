# Hedera Transaction Tool Tests

This project contains automated tests for the Hedera Transaction Tool. The tests are written with
[Playwright](https://playwright.dev/) and cover local-user, localnet, and organization flows.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- Node.js: `22.12.0`

Additionally, you should either:

- have the Hedera Transaction Tool executable installed and know its path for launch mode, or
- run the front-end Electron app with remote debugging enabled if you want automation to attach to an existing app
  instance.

For organization and shared localnet suites, you also need the dependent services running locally:

- Hedera localnet / Solo for `@local-transactions`
- Hedera localnet / Solo plus back-end API + PostgreSQL for `@organization-basic` and
  `@organization-advanced`

## Setup

1. **Clone the repository** to your local machine:

   ```bash
   git clone <repository-url>
   ```

2. **Navigate to the automation directory**:

   ```bash
   cd hedera-transaction-tool/automation
   ```

3. **Install dependencies**:

   ```bash
   pnpm install
   pnpm approve-builds # if required by pnpm install
   ```

4. **Configure environment variables** by creating a `.env` file in `automation/`.

   Launch mode example:

   ```env
   ELECTRON_APP_MODE='launch'
   EXECUTABLE_PATH='/path/to/Hedera Transaction Tool'
   PLAYWRIGHT_TEST=true
   PLAYWRIGHT_WORKERS=2
   PLAYWRIGHT_SHARED_ENV=true

   PRIVATE_KEY='your_private_key_here'
   ENVIRONMENT='LOCALNET'
   ORGANIZATION_URL='https://localhost:3001'

   POSTGRES_HOST='localhost'
   POSTGRES_PORT='5432'
   POSTGRES_DATABASE='postgres'
   POSTGRES_USERNAME='postgres'
   POSTGRES_PASSWORD='postgres'
   ```

   Attach mode example:

   ```env
   ELECTRON_APP_MODE='attach'
   ELECTRON_ATTACH_URL='http://127.0.0.1:9222'
   PLAYWRIGHT_TEST=true
   PLAYWRIGHT_WORKERS=1
   PLAYWRIGHT_PRESERVE_BACKEND_STATE='true'

   PRIVATE_KEY='your_private_key_here'
   ENVIRONMENT='LOCALNET'
   ```

   In attach mode, automation preserves the existing Electron local state and SQLite database by default.
   Set `ELECTRON_PRESERVE_APP_STATE='false'` if you need the previous cleanup behavior.
   Set `PLAYWRIGHT_PRESERVE_BACKEND_STATE='true'` if you also want to skip PostgreSQL truncation and
   Redis rate-limiter flushes during local attach-mode debugging without enabling shared-env mode.

   If you use attach mode, start the front-end first from `front-end/`:

   ```bash
   PLAYWRIGHT_TEST=true ELECTRON_REMOTE_DEBUGGING_PORT=9222 pnpm dev
   ```

   Replace `ENVIRONMENT` with `TESTNET`, `PREVIEWNET`, or `LOCALNET`.

   Depending on the selected environment:

   - TESTNET: use ECDSA private keys
   - PREVIEWNET: use ECDSA private keys
   - LOCALNET: use ED25519 private keys

## Running Tests

Run all automation tests from `automation/`:

```bash
pnpm exec playwright test
```

Run a single suite:

```bash
pnpm exec playwright test tests/registrationTests.test.ts
```

List discovered tests:

```bash
pnpm exec playwright test --list
```

## Parallel Local Execution

### Launch Mode

Use launch mode when you want Playwright workers to start isolated Electron instances automatically. In shared-env
mode each worker gets its own Chromium user-data directory, SQLite database, and session partition.

Shared local/basic validation:

```bash
ELECTRON_APP_MODE=launch \
PLAYWRIGHT_SHARED_ENV=true \
PLAYWRIGHT_WORKERS=2 \
pnpm exec playwright test --grep "@local-basic|@local-transactions"
```

Shared infra-heavy validation:

```bash
ELECTRON_APP_MODE=launch \
PLAYWRIGHT_SHARED_ENV=true \
PLAYWRIGHT_WORKERS=3 \
pnpm exec playwright test --grep "@local-transactions|@organization-basic|@organization-advanced"
```

These commands assume:

- `EXECUTABLE_PATH` points to a working Electron build
- localnet is available for `@local-transactions`
- `ORGANIZATION_URL` and `POSTGRES_*` are configured for organization suites

### Attach Mode

Attach mode does not create worker-local Electron instances. For parallel local execution, run one Electron app
instance per Playwright process, each with its own remote debugging port and Playwright user-data directory.

From `front-end/`, start one app per terminal:

```bash
PLAYWRIGHT_TEST=true \
PLAYWRIGHT_USER_DATA_DIR=/tmp/htt-attach-0 \
PLAYWRIGHT_SESSION_PARTITION=persist:htt-attach-0 \
PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK=true \
ELECTRON_REMOTE_DEBUGGING_PORT=9222 \
pnpm dev
```

```bash
PLAYWRIGHT_TEST=true \
PLAYWRIGHT_USER_DATA_DIR=/tmp/htt-attach-1 \
PLAYWRIGHT_SESSION_PARTITION=persist:htt-attach-1 \
PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK=true \
ELECTRON_REMOTE_DEBUGGING_PORT=9223 \
pnpm dev
```

Then, from `automation/`, run one Playwright process per attached app. Keep `PLAYWRIGHT_SHARED_ENV=true`
for parallel shared-environment runs so automation does not truncate shared PostgreSQL state or flush Redis between
suites:

```bash
ELECTRON_APP_MODE=attach \
ELECTRON_ATTACH_URL=http://127.0.0.1:9222 \
PLAYWRIGHT_SHARED_ENV=true \
PLAYWRIGHT_WORKERS=1 \
pnpm exec playwright test --grep "@local-basic" &

ELECTRON_APP_MODE=attach \
ELECTRON_ATTACH_URL=http://127.0.0.1:9223 \
PLAYWRIGHT_SHARED_ENV=true \
PLAYWRIGHT_WORKERS=1 \
pnpm exec playwright test --grep "@local-transactions" &

wait
```

To shard more suites in attach mode, repeat the same pattern with more Electron instances, ports, and user-data
directories.

## CI Workflow

The GitHub Actions workflow in `.github/workflows/test-frontend.yaml` runs three jobs:

- `build`: installs front-end dependencies, builds the Linux executable, and caches
  `front-end/release/linux-unpacked`
- `test`: restores the built executable and runs the Playwright automation matrix
- `unit-test`: runs the front-end unit test matrix for main, renderer, and shared code

The Playwright automation job has two matrix entries:

1. `Local Basic`

   - grep: `@local-basic`
   - `PLAYWRIGHT_SHARED_ENV=false`
   - `PLAYWRIGHT_WORKERS=1`
   - no Solo deployment
   - no back-end deployment

2. `Shared E2E`

   - grep: `@local-transactions|@organization-basic|@organization-advanced`
   - `PLAYWRIGHT_SHARED_ENV=true`
   - `PLAYWRIGHT_WORKERS=3`
   - installs Kind and Solo CLI
   - deploys Solo once
   - deploys the back end once with Docker Compose

For the shared E2E job, the workflow:

- installs `mkcert` and `socat`
- generates local HTTPS certificates
- copies back-end `example.env` files into working `.env` files
- aligns the back-end supported front-end version with `front-end/package.json`
- raises API throttling limits for the shared run
- waits for Solo and the back-end API to become ready

The automation command in CI is:

```bash
xvfb-run -a npx playwright test --grep "<matrix grep>"
```

CI sets these runtime variables before running that command:

- `EXECUTABLE_PATH=../front-end/release/linux-unpacked/hedera-transaction-tool`
- `ENVIRONMENT=LOCALNET`
- `PLAYWRIGHT_SHARED_ENV`
- `PLAYWRIGHT_WORKERS`
- `ORGANIZATION_URL=https://localhost:3001` for back-end-dependent suites
- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5432`
- `POSTGRES_DATABASE=postgres`
- `POSTGRES_USERNAME=postgres`
- `POSTGRES_PASSWORD=postgres`

After execution, the workflow uploads the Playwright HTML report, raw test results, and Solo / Kind diagnostics when
available.

## Current Test Suites

### 1. Registration tests

```bash
pnpm exec playwright test tests/registrationTests.test.ts
```

### 2. Login tests

```bash
pnpm exec playwright test tests/loginTests.test.ts
```

### 3. Settings tests

```bash
pnpm exec playwright test tests/settingsTests.test.ts
```

### 4. Transactions tests

```bash
pnpm exec playwright test tests/transactionTests.test.ts
```

### 5. Workflow tests

```bash
pnpm exec playwright test tests/workflowTests.test.ts
```

### 6. Organization Settings tests

```bash
pnpm exec playwright test tests/organizationSettingsTests.test.ts
```

### 7. Organization Transaction tests

```bash
pnpm exec playwright test tests/organizationTransactionTests.test.ts
```

### 8. Organization Contact List tests

```bash
pnpm exec playwright test tests/organizationContactListTests.test.ts
```

### 9. Organization Regression tests

```bash
pnpm exec playwright test tests/organizationRegressionTests.test.ts
```

### 10. Organization Notification tests

```bash
pnpm exec playwright test tests/organizationNotificationTests.test.ts
```

### 11. Group transaction tests

```bash
pnpm exec playwright test tests/groupTransactionTests.test.ts
```

### 12. Group organization tests

```bash
pnpm exec playwright test tests/organizationGroupTests.test.ts
```
