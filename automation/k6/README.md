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
