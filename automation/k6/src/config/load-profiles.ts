/**
 * k6 Load Test Profiles
 *
 * Reusable load stages and threshold configurations.
 */

import { LOAD_TEST, THRESHOLDS } from './constants';

/**
 * Stage configuration for k6 options
 */
export interface LoadStage {
  duration: string;
  target: number;
}

/**
 * Standard load test stages
 * Ramps up to 100 concurrent users, sustains, then ramps down
 */
export const STANDARD_LOAD_STAGES: LoadStage[] = [
  { duration: '1m', target: 50 },
  { duration: '2m', target: LOAD_TEST.CONCURRENT_USERS },
  { duration: '3m', target: LOAD_TEST.CONCURRENT_USERS },
  { duration: '1m', target: 0 },
];

/**
 * Standard thresholds for tab/page loading
 * p(95) < 1 second, < 1% failure rate
 */
export const TAB_LOAD_THRESHOLDS: Record<string, string[]> = {
  http_req_duration: [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
  http_req_failed: ['rate<0.01'],
};
