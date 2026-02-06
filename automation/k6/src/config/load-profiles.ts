/**
 * k6 Load Test Profiles
 *
 * Reusable load stages and threshold configurations.
 * VUs configurable via -e VUS=N environment variable.
 */

import { LOAD_TEST, THRESHOLDS } from './constants';
import type { LoadStage } from '../types';

/**
 * Generate load test stages based on target VUs
 *
 * Profile scales with VU count:
 *   - Ramp up to 50% of target
 *   - Ramp to 100% of target
 *   - Sustain at target
 *   - Ramp down
 *
 * Duration scales with VUs:
 *   - 10 VUs  → ~3 min total (quick baseline)
 *   - 30 VUs  → ~5 min total (medium load)
 *   - 50 VUs  → ~6 min total (heavy load)
 *   - 100 VUs → ~7 min total (stress test)
 */
function generateLoadStages(targetVUs: number): LoadStage[] {
  const halfTarget = Math.max(1, Math.floor(targetVUs / 2));

  // Scale duration based on VU count (more VUs = longer test)
  if (targetVUs <= 10) {
    // Quick baseline: 3 min total
    return [
      { duration: '30s', target: halfTarget },
      { duration: '30s', target: targetVUs },
      { duration: '1m30s', target: targetVUs },
      { duration: '30s', target: 0 },
    ];
  } else if (targetVUs <= 30) {
    // Medium load: 5 min total
    return [
      { duration: '1m', target: halfTarget },
      { duration: '1m', target: targetVUs },
      { duration: '2m', target: targetVUs },
      { duration: '1m', target: 0 },
    ];
  } else if (targetVUs <= 50) {
    // Heavy load: 6 min total
    return [
      { duration: '1m', target: halfTarget },
      { duration: '1m30s', target: targetVUs },
      { duration: '2m30s', target: targetVUs },
      { duration: '1m', target: 0 },
    ];
  } else {
    // Stress test (51+ VUs): 7 min total
    return [
      { duration: '1m', target: halfTarget },
      { duration: '2m', target: targetVUs },
      { duration: '3m', target: targetVUs },
      { duration: '1m', target: 0 },
    ];
  }
}

/**
 * Standard load test stages
 * Automatically scales based on VUS environment variable
 */
export const STANDARD_LOAD_STAGES: LoadStage[] = generateLoadStages(LOAD_TEST.CONCURRENT_USERS);

/**
 * Standard thresholds for tab/page loading
 * p(95) < 1 second, < 1% failure rate
 */
export const TAB_LOAD_THRESHOLDS: Record<string, string[]> = {
  http_req_duration: [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
  http_req_failed: ['rate<0.01'],
};
