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

## Quick Start

```bash
cd automation

# Seed test user (required once)
npm run k6:seed

# Build TypeScript and run smoke test
npm run k6:smoke

# Run all tab load times
npm run k6:tabs

# Run with Grafana dashboards
npm run grafana:start
npm run k6:tabs:grafana
```

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
│   │   └── options.ts            # Load test profiles
│   └── types/                    # Type definitions
├── helpers/                      # Node.js utilities (not k6 runtime)
│   ├── seed-test-users.ts        # Create test users
│   ├── seed-perf-data.ts         # Seed transactions
│   ├── complex-keys.ts           # Generate complex threshold keys
│   ├── create-complex-accounts.ts # Bootstrap Hedera accounts
│   └── sign-transactions.ts      # Pre-sign transactions
├── dist/                         # Compiled JS (gitignored)
├── webpack.config.js             # Bundler config
└── README.md
```

## Test Scripts

| Script | Purpose | Threshold |
|--------|---------|-----------|
| `smoke-test.ts` | Health check | API responds |
| `tab-load-times.ts` | All 7 tabs | < 1 second each |
| `sign-all.ts` | Sign 200 transactions | < 4 seconds |
| `ready-to-sign.ts` | Ready to Sign tab | < 1 second |
| `ready-to-approve.ts` | Ready to Approve tab | < 1 second |
| `all-transactions.ts` | All Transactions tab | < 1 second |
| `history.ts` | History tab | < 1 second |
| `notifications.ts` | Notifications tab | < 1 second |

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
5. Rebuild: `npm run k6:build`

### Type Definitions

All types are in `src/types/`:
- `api.types.ts` - API response interfaces (AuthResponse, Transaction, etc.)
- `config.types.ts` - Configuration types (Environment, K6Options, etc.)
- `k6.types.ts` - k6 runtime types (SetupData, SummaryData, etc.)

## Available npm Scripts

| Script | Description | Duration |
|--------|-------------|----------|
| `k6:build` | Build TypeScript to JavaScript | - |
| `k6:smoke` | Quick health check | 30s |
| `k6:tabs` | All tabs baseline test | 2 min |
| `k6:ready-to-sign` | Ready to Sign load test | 7 min |
| `k6:ready-to-approve` | Ready to Approve load test | 7 min |
| `k6:all-transactions` | All Transactions load test | 7 min |
| `k6:history` | History load test | 7 min |
| `k6:notifications` | Notifications load test | 7 min |
| `k6:sign-all` | Batch signing test | 2 min |
| `k6:seed` | Seed test users only | - |
| `k6:seed:all` | Seed users + transactions | - |
| `k6:baseline` | Smoke + all tabs | 2.5 min |
| `k6:load:all` | Full load tests (100 VUs) | 35 min |
| `k6:bootstrap:complex` | Setup complex key account (localnet) | - |
| `grafana:start` | Start Grafana + InfluxDB | - |
| `grafana:stop` | Stop monitoring stack | - |

Add `:grafana` suffix to any test for dashboard output.

## Requirements

- k6 installed (`brew install k6`)
- Node.js 22+ (for build tooling)
- Backend running (`docker-compose up` in back-end/)
- Test user seeded (`npm run k6:seed`)

## Running Against Staging Environment

The `:staging` scripts run tests against the staging environment for production readiness validation.

### Prerequisites

- VPN access to the network
- Teleport CLI installed and authenticated
- Appropriate IAM permissions

### Setup

1. **Authenticate with Teleport:**
   ```bash
   tsh login --proxy=hashgraph.teleport.sh:443 hashgraph.teleport.sh
   ```

2. **Start the database tunnel (in a separate terminal):**
   ```bash
   tsh proxy db --tunnel gcp-tt-staging-postgres --db-user=teleport-cloudsql-user@transaction-tool-dev.iam --db-name=staging --port 54320
   ```

3. **Run tests:**
   ```bash
   pnpm run k6:smoke:staging      # Quick health check
   pnpm run k6:tabs:staging       # Tab load times
   pnpm run k6:baseline:staging   # Smoke + tabs combined
   ```

### Staging Scripts

| Script | Description | Duration |
|--------|-------------|----------|
| `k6:smoke:staging` | Smoke test against staging | 30s |
| `k6:tabs:staging` | All tabs baseline | 2 min |
| `k6:baseline:staging` | Smoke + tabs combined | 2.5 min |
| `k6:ready-to-sign:staging` | Ready to Sign load test | 7 min |
| `k6:seed:staging` | Seed test user to staging database | - |
| `k6:seed:data:staging` | Seed transaction data to staging | - |
| `k6:seed:all:staging` | Seed user + transactions to staging | - |

### Configurable Load (VUs)

The number of virtual users (VUs) can be overridden for any load test:

```bash
# Default: 100 VUs, 7 min (stress test)
pnpm run k6:ready-to-sign:staging

# Light load: 10 VUs
k6 run -e VUS=10 -e ENV=staging -e USER_EMAIL=k6perf@test.com -e USER_PASSWORD=Password123 k6/dist/ready-to-sign.js

# Medium load: 30 VUs
k6 run -e VUS=30 -e ENV=staging -e USER_EMAIL=k6perf@test.com -e USER_PASSWORD=Password123 k6/dist/ready-to-sign.js
```

**Recommended progression to find breaking point:**
1. `VUS=3` - Baseline (target <1s responses)
2. `VUS=10` - Light load
3. `VUS=20` - Medium load (100% success threshold)
4. `VUS=50` - Heavy load (failure detection)

### How It Works

- Staging scripts automatically seed data before running tests
- Data is seeded via the Teleport tunnel to the remote PostgreSQL database
- Tests run against `staging-transaction-tool.swirldslabs-devops.com`
- The `FRONTEND_VERSION` constant in `src/config/constants.ts` must match the backend's minimum supported version
