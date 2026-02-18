# k6 API/Load Performance Tests

Backend performance testing using [k6](https://k6.io/) - tests API response times under load.

## Purpose

These tests measure **backend/API performance**:
- API response times under concurrent user load
- Transaction signing throughput
- Database query performance via API

**Target:** Tab load times < 1 second under 100+ concurrent users

## Key Difference from UI Performance Tests

| This folder (`k6/`) | `tests/ui-performance/` |
|---------------------|-------------------------|
| Tests the **backend API** directly | Tests the **Electron UI** |
| Runs in k6 runtime (not Node.js) | Runs in Playwright/Node.js |
| Simulates 100+ concurrent users | Single user, measures render times |
| No browser/UI involved | Launches actual Electron app |

## Prerequisites

- **k6** - Install with `brew install k6` (macOS) or see [k6 installation docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **pnpm** - Package manager (`npm install -g pnpm`)
- **Backend running** - See the backend README for setup instructions

## Local Setup

1. **Install dependencies:**
   ```bash
   cd automation
   pnpm install
   ```

2. **Start the backend** (see the backend `README.md` for detailed instructions).

3. **Run the smoke test** to verify everything works:
   ```bash
   cd automation
   npm run k6:smoke
   ```
   This will automatically seed test data, build the TypeScript, and run a 30-second health check.

   > **Note:** Local tests assume the backend is running on HTTP (`http://localhost:3001`). If using HTTPS, set the `BASE_URL` environment variable: `k6 run -e BASE_URL=https://localhost:3001 k6/dist/smoke-test.js`

4. **Run the full baseline** (all 7 tabs at 1 VU):
   ```bash
   npm run k6:baseline
   ```

5. **Run individual load tests** (default 100 VUs):
   ```bash
   npm run k6:ready-to-sign
   npm run k6:history
   ```

All `k6:*` test scripts (smoke, tabs, load tests) automatically handle seeding and building before running.

## Staging Setup

Running against a staging environment requires database access for seeding test data and the staging API URL.

### Step 1: Configure database connection

Set the `POSTGRES_*` environment variables to point to the staging database:

```bash
export POSTGRES_HOST=<db-host>
export POSTGRES_PORT=<db-port>
export POSTGRES_DATABASE=<db-name>
export POSTGRES_USERNAME=<db-user>
export POSTGRES_PASSWORD=<db-password>  # defaults to 'postgres' if not set
```

### Step 2: Seed test data and build

```bash
cd automation
npm run k6:seed:all   # Seed test users + transactions
npm run k6:build      # Build TypeScript to JavaScript
```

### Step 3: Run tests

Staging tests use raw `k6 run` commands with `-e ENV=staging` and `-e BASE_URL=...`:

```bash
export BASE_URL=https://your-staging-url.com

# Quick health check
k6 run -e ENV=staging -e BASE_URL=$BASE_URL k6/dist/smoke-test.js

# All tabs baseline (1 VU)
k6 run -e ENV=staging -e BASE_URL=$BASE_URL k6/dist/tab-load-times.js

# Individual load tests (default 100 VUs)
k6 run -e ENV=staging -e BASE_URL=$BASE_URL k6/dist/ready-to-sign.js
```

### Configurable Load (VUs)

The number of virtual users (VUs) can be overridden using the `VUS` environment variable:

```bash
# Custom VUs:
k6 run -e ENV=staging -e BASE_URL=$BASE_URL -e VUS=50 k6/dist/ready-to-sign.js
```

**Recommended progression:**
1. `VUS=3` - Baseline (target < 1s responses)
2. `VUS=10` - Light load
3. `VUS=20` - Medium load (100% success threshold)
4. `VUS=50` - Heavy load (failure detection)

### Important Notes

- The `FRONTEND_VERSION` constant in `src/config/constants.ts` must match the backend's minimum supported version
- Staging tests must be run **sequentially** (not in parallel) to get accurate performance measurements
- Default test credentials (`k6perf@test.com` / `Password123`) are baked into the JS code; override via `-e USER_EMAIL=... -e USER_PASSWORD=...`
- `HEDERA_NETWORK` defaults to `mainnet` for both seeding and k6 queries; if changed, use the same value for both to keep data consistent

## Reports

Every test generates reports automatically via `handleSummary()`:

| Output | Location | Description |
|--------|----------|-------------|
| HTML report | `reports/k6/{test-name}.html` | Visual report with checks, thresholds, and metrics |
| JSON report | `reports/k6/{test-name}.json` | Raw k6 summary data |
| Console | stdout | Colored text summary in terminal |

### Reading the HTML Report

Open any `.html` report in a browser. Key sections:

- **Checks & Groups** - Shows each API endpoint tested with pass/fail count and percentage (e.g., `GET /transaction-nodes?collection=READY_TO_SIGN -> status 200: 82% pass`)
- **Thresholds** - Green/red indicators for SLA targets (e.g., p95 response time < 1000ms)
- **Detailed Metrics** - Request durations (avg, p90, p95, max), data transferred, iteration counts

## Project Structure

```
k6/
├── src/                          # TypeScript source (k6 runtime)
│   ├── scripts/                  # Test scripts
│   │   ├── smoke-test.ts         # Health check
│   │   ├── tab-load-times.ts     # All tabs baseline
│   │   ├── sign-all.ts           # Batch signing
│   │   └── [tab-name].ts         # Individual tab tests
│   ├── lib/                      # k6 helper functions
│   │   ├── helpers.ts            # Auth, HTTP utilities
│   │   ├── setup.ts              # Test setup/teardown
│   │   └── utils.ts              # Reporting utilities
│   ├── config/                   # Configuration
│   │   ├── constants.ts          # Shared constants (SSOT)
│   │   ├── environments.ts       # Environment URLs
│   │   └── load-profiles.ts      # Load test profiles and stages
│   └── types/                    # Type definitions
├── helpers/                      # Node.js utilities (not k6 runtime)
│   ├── seed-test-users.ts        # Create test users
│   ├── seed-perf-data.ts         # Seed transactions
│   ├── complex-keys.ts           # Generate complex threshold keys
│   ├── create-complex-accounts.ts # Bootstrap Hedera accounts
│   └── sign-transactions.ts      # Pre-sign transactions
├── dist/                         # Compiled JS (gitignored)
├── docker-compose.yml            # Grafana + InfluxDB stack
├── webpack.config.js             # Bundler config
└── README.md
```

## Test Scripts

| Script | Purpose | Threshold |
|--------|---------|-----------|
| `smoke-test.ts` | Health check | API responds |
| `tab-load-times.ts` | All 7 tabs (1 VU baseline) | < 1 second each |
| `sign-all.ts` | Sign 500 transactions | < 4 seconds |
| `ready-to-sign.ts` | Ready to Sign tab | < 1 second |
| `ready-to-approve.ts` | Ready to Approve tab | < 1 second |
| `in-progress.ts` | In Progress tab | < 1 second |
| `all-transactions.ts` | All Transactions tab | < 1 second |
| `history.ts` | History tab | < 1 second |
| `notifications.ts` | Notifications tab | < 1 second |

## Common npm Scripts

For the full list of scripts, see `automation/package.json`.

| Script | Description | Duration |
|--------|-------------|----------|
| `k6:build` | Build TypeScript to JavaScript | - |
| `k6:smoke` | Quick health check | 30s |
| `k6:tabs` | All tabs baseline test (1 VU) | 2 min |
| `k6:baseline` | Smoke + all tabs combined | 2.5 min |
| `k6:ready-to-sign` | Ready to Sign load test | 7 min |
| `k6:ready-to-approve` | Ready to Approve load test | 7 min |
| `k6:in-progress` | In Progress load test | 7 min |
| `k6:all-transactions` | All Transactions load test | 7 min |
| `k6:history` | History load test | 7 min |
| `k6:notifications` | Notifications load test | 7 min |
| `k6:sign-all` | Batch signing test | 2 min |
| `k6:load:all` | Full load test suite (all endpoints) | 35 min |
| `k6:seed` | Seed test users only | - |
| `k6:seed:all` | Seed users + transactions | - |

Add `:grafana` suffix for Grafana dashboard output (e.g., `k6:tabs:grafana`). For staging, use raw `k6 run` commands (see [Staging Setup](#staging-setup)).

## Development

### Building

```bash
# Build TypeScript to JavaScript
npm run k6:build

# Build is automatic with all k6:* commands
npm run k6:smoke  # Builds then runs
```

### Adding New Tests

1. Create `src/scripts/my-test.ts`
2. Import types from `../types`
3. Import helpers from `../lib/helpers`
4. Export `options`, `setup()`, `default()`, `handleSummary()`
5. Add a webpack entry in `webpack.config.js`
6. Add npm scripts in `package.json`
7. Rebuild: `npm run k6:build`

### Type Definitions

All types are in `src/types/`:
- `api.types.ts` - API response interfaces (AuthResponse, Transaction, etc.)
- `config.types.ts` - Configuration types (Environment, K6Options, etc.)
- `k6.types.ts` - k6 runtime types (SetupData, SummaryData, etc.)

## Grafana Dashboards

For real-time visualization during test runs:

```bash
# Start the monitoring stack (Grafana + InfluxDB)
npm run grafana:start

# Run any test with :grafana suffix
npm run k6:tabs:grafana

# Access Grafana at http://localhost:3030
# Stop when done
npm run grafana:stop
```

> **Note:** Requires Docker running. If Grafana doesn't load, verify Docker is running and port 3030 is available.

The Grafana dashboard shows live metrics: request rates, response times, error rates, and VU count over time.
