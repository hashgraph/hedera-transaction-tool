# UI Performance Tests (Playwright)

Frontend performance testing using Playwright - measures Electron app responsiveness.

## Purpose

These tests measure **frontend/UI performance**:
- App startup time
- Page load and render times
- UI responsiveness under data load

**Target:** All pages load in < 1 second with 100+ items

## Key Difference from k6 Tests

| This folder (`tests/ui-performance/`) | `k6/` |
|---------------------------------------|-------|
| Tests the **Electron UI** | Tests the **backend API** directly |
| Runs in Playwright/Node.js | Runs in k6 runtime |
| Single user, measures render times | Simulates 100+ concurrent users |
| Launches actual Electron app | No browser/UI involved |

## Test Files

### Local Mode Tests (SQLite)
| Test | What It Measures | Data Volume | Threshold |
|------|------------------|-------------|-----------|
| `appStartupPerformance.test.ts` | Time to launch Electron app | - | < 3 seconds |
| `draftsPerformance.test.ts` | Drafts tab load time | 100 items | < 1 second (p95) |
| `accountsPerformance.test.ts` | Accounts page load time | 100 items | < 1 second (p95) |
| `filesPerformance.test.ts` | Files page load time | 100 items | < 1 second (p95) |
| `historyPerformanceLocal.test.ts` | History tab load time (local) | 500 txns | < 1 second (p95) |

### Org Mode Tests (PostgreSQL)
| Test | What It Measures | Data Volume | Threshold |
|------|------------------|-------------|-----------|
| `contactsPerformance.test.ts` | Contacts page load time | 100 users | < 1 second (p95) |
| `readyToSignPerformance.test.ts` | Ready to Sign tab | 200 txns | < 1 second (p95) |
| `readyForReviewPerformance.test.ts` | Ready for Review tab | 100 txns | < 1 second (p95) |
| `inProgressPerformance.test.ts` | In Progress tab | 200 txns | < 1 second (p95) |
| `readyForExecutionPerformance.test.ts` | Ready for Execution tab | 100 txns | < 1 second (p95) |
| `historyPerformance.test.ts` | History tab | 500 txns | < 1 second (p95) |
| `signAllPerformance.test.ts` | Sign All operation | 500 txns | < 4 seconds |
| `signAllComplexKeyPerformance.test.ts` | Sign All with complex keys | 100 txns | < 4 seconds |

## Running Tests

```bash
cd automation

# Local mode tests (no backend needed)
npx playwright test tests/ui-performance/draftsPerformance.test.ts
npx playwright test tests/ui-performance/accountsPerformance.test.ts
npx playwright test tests/ui-performance/filesPerformance.test.ts
npx playwright test tests/ui-performance/historyPerformanceLocal.test.ts

# Org mode tests (requires backend + seeding)
npm run k6:seed:all  # Seed backend with test data
npx playwright test tests/ui-performance/readyToSignPerformance.test.ts
npx playwright test tests/ui-performance/historyPerformance.test.ts
```

## Requirements

- Built Electron app binary
- Dependencies installed (`pnpm install`)
- A `.env` file in `automation/` (copy from `example.env`) with at minimum:
  - `EXECUTABLE_PATH` - Path to the built Electron app binary
  - `ORGANIZATION_URL` - Backend URL for org mode tests (e.g., `http://localhost:3001`)
- For org mode tests: Backend running + `npm run k6:seed:all`

## Utilities

`performanceUtils.ts` provides:
- `collectPerformanceSamples()` - Gather multiple timing samples, returns p95/avg/min/max
- `waitForRowCount()` - Wait for minimum row count in list
- `waitForGroupRow()` - Wait for transaction group row (Sign All tests)
- `formatDuration()` - Format milliseconds for display
- `setPageSize()` - Set pagination size via AppPager dropdown
- `getPagerTotal()` - Get total item count from pager
- `enforceVolumeRequirement()` - Validate data volume before measuring
- `navigateToReadyToSign()` - Navigate to Ready to Sign tab and wait for data

## Data Seeding

### Local Mode
Tests use `seed-local-perf-data.ts` to insert into SQLite:
- 100 TransactionDraft records
- 100 HederaAccount records
- 100 HederaFile records
- 500 Transaction records (for local History)

### Org Mode
Tests use `npm run k6:seed:all` which creates:
- 200 transactions for Ready to Sign (also visible in In Progress)
- 100 transactions for Ready to Approve
- 100 transactions for Ready for Execution
- 500 transactions for History
