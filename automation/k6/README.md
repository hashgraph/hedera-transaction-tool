# k6 API/Load Performance Tests

Backend performance testing using [k6](https://k6.io/) - tests API response times under load.

## Purpose

These tests measure **backend/API performance**:
- API response times under concurrent user load
- Transaction signing throughput
- Database query performance via API

**Target:** 100+ concurrent users, all API responses < 1 second

## Key Difference from UI Performance Tests

| This folder (`k6/`) | `tests/ui-performance/` |
|---------------------|-------------------------|
| Tests the **backend API** directly | Tests the **Electron UI** |
| Runs in k6 runtime (not Node.js) | Runs in Playwright/Node.js |
| Simulates 100+ concurrent users | Single user, measures render times |
| No browser/UI involved | Launches actual Electron app |

## Prerequisites

### Local

- **k6** - Install with `brew install k6` (macOS) or see [k6 installation docs](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- **Node.js 22+** - Required for build tooling and seeding scripts
- **pnpm** - Package manager (`npm install -g pnpm`)
- **Backend running** - The backend API must be running locally (see below)

### Staging (additional)

- VPN access to the network
- **Teleport CLI** installed and authenticated (`tsh`)
- Appropriate IAM permissions for staging database access

## Local Setup

1. **Install dependencies:**
   ```bash
   cd automation
   pnpm install
   ```

2. **Start the backend** (in a separate terminal):
   ```bash
   cd back-end
   docker-compose up
   ```

3. **Run the smoke test** to verify everything works:
   ```bash
   cd automation
   npm run k6:smoke
   ```
   This will automatically seed test data, build the TypeScript, and run a 30-second health check.

4. **Run the full baseline** (all 7 tabs at 1 VU):
   ```bash
   npm run k6:baseline
   ```

5. **Run individual load tests** (default 100 VUs):
   ```bash
   npm run k6:ready-to-sign
   npm run k6:history
   ```

All `k6:*` npm scripts automatically handle seeding and building before running tests.

## Staging Setup

The `:staging` scripts run tests against `staging-transaction-tool.swirldslabs-devops.com` for production readiness validation.

### Step 1: Authenticate with Teleport

```bash
tsh login --proxy=hashgraph.teleport.sh:443 hashgraph.teleport.sh
```

### Step 2: Start the database tunnel

Open a **separate terminal** and keep it running:

```bash
tsh proxy db --tunnel gcp-tt-staging-postgres \
  --db-user=teleport-cloudsql-user@transaction-tool-dev.iam \
  --db-name=staging \
  --port 54320
```

This tunnel is required for seeding test data to the staging database. The staging npm scripts expect the tunnel on `localhost:54320`.

### Step 3: Run tests

```bash
cd automation

# Quick health check
npm run k6:smoke:staging

# All tabs baseline (1 VU)
npm run k6:baseline:staging

# Individual load tests (default 100 VUs)
npm run k6:ready-to-sign:staging
npm run k6:history:staging
```

Staging scripts automatically seed data via the Teleport tunnel before running tests.

### Configurable Load (VUs)

The number of virtual users (VUs) can be overridden for any load test using the `VUS` environment variable:

```bash
# Default: 100 VUs
npm run k6:ready-to-sign:staging

# Custom VUs (requires raw k6 command):
k6 run -e VUS=50 -e ENV=staging \
  -e USER_EMAIL=k6perf@test.com -e USER_PASSWORD=Password123 \
  k6/dist/ready-to-sign.js
```

**Recommended progression:**
1. `VUS=3` - Baseline (target < 1s responses)
2. `VUS=10` - Light load
3. `VUS=20` - Medium load (100% success threshold)
4. `VUS=50` - Heavy load (failure detection)

### Important Notes

- The `FRONTEND_VERSION` constant in `src/config/constants.ts` must match the backend's minimum supported version
- Tests run against `staging-transaction-tool.swirldslabs-devops.com` (not through the tunnel — the tunnel is only for database seeding)
- Staging tests must be run **sequentially** (not in parallel) to get accurate performance measurements

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
| `sign-all.ts` | Sign 200 transactions | < 4 seconds |
| `ready-to-sign.ts` | Ready to Sign tab | < 1 second |
| `ready-to-approve.ts` | Ready to Approve tab | < 1 second |
| `in-progress.ts` | In Progress tab | < 1 second |
| `all-transactions.ts` | All Transactions tab | < 1 second |
| `history.ts` | History tab | < 1 second |
| `notifications.ts` | Notifications tab | < 1 second |

## Available npm Scripts

### Local

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
| `k6:bootstrap:complex` | Setup complex key account (localnet) | - |
| `grafana:start` | Start Grafana + InfluxDB | - |
| `grafana:stop` | Stop monitoring stack | - |

Add `:grafana` suffix to any test for Grafana dashboard output (e.g., `k6:tabs:grafana`).

### Staging

| Script | Description | Duration |
|--------|-------------|----------|
| `k6:smoke:staging` | Smoke test against staging | 30s |
| `k6:tabs:staging` | All tabs baseline | 2 min |
| `k6:baseline:staging` | Smoke + tabs combined | 2.5 min |
| `k6:ready-to-sign:staging` | Ready to Sign load test | 7 min |
| `k6:ready-to-approve:staging` | Ready to Approve load test | 7 min |
| `k6:in-progress:staging` | In Progress load test | 7 min |
| `k6:all-transactions:staging` | All Transactions load test | 7 min |
| `k6:history:staging` | History load test | 7 min |
| `k6:notifications:staging` | Notifications load test | 7 min |
| `k6:load:all:staging` | Full load test suite | 35 min |
| `k6:seed:staging` | Seed test user to staging DB | - |
| `k6:seed:data:staging` | Seed transaction data to staging | - |
| `k6:seed:all:staging` | Seed user + transactions to staging | - |

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
6. Add npm scripts in `package.json` (local + staging variants)
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

# Access Grafana at http://localhost:3000
# Stop when done
npm run grafana:stop
```

The Grafana dashboard shows live metrics: request rates, response times, error rates, and VU count over time.
