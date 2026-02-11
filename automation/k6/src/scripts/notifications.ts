/**
 * Notifications Load Test
 *
 * Requirements:
 * - Page load < 1 second
 * - 100+ concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { endpoints } from '../config/environments';
import { THRESHOLDS, DELAYS, HTTP_STATUS } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type { K6Options, MultiUserSetupData, SummaryData, SummaryOutput } from '../types';

declare const __ENV: Record<string, string | undefined>;
const DEBUG = __ENV.DEBUG === 'true';

/**
 * k6 options configuration
 */
export const options: K6Options = {
  scenarios: {
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: STANDARD_LOAD_STAGES,
      tags: { scenario: 'load' },
    },
  },
  thresholds: {
    'http_req_duration{name:notifications}': [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    ...TAB_LOAD_THRESHOLDS,
  },
};

const BASE_URL = getBaseUrlWithFallback();

/**
 * Setup function - authenticates all configured test users
 */
export function setup(): MultiUserSetupData {
  return multiUserSetup(BASE_URL);
}

/**
 * Main test function
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);

  group('Notifications Page', () => {
    const res = http.get(`${BASE_URL}${endpoints['notifications']}`, {
      ...headers,
      tags: { name: 'notifications' },
    });

    check(res, {
      'GET /notifications → status 200': (r) => r.status === HTTP_STATUS.OK,
      'GET /notifications → response < 1s': (r) => r.timings.duration < THRESHOLDS.PAGE_LOAD_MS,
    });

    if (DEBUG) console.log(`Notifications load time: ${formatDuration(res.timings.duration)}`);
  });

  sleep(DELAYS.BETWEEN_ITERATIONS);
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'notifications', 'Notifications');
}
