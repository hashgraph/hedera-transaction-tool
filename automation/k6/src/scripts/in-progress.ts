/**
 * In Progress Load Test
 *
 * Tests transactions with status "WAITING FOR SIGNATURES"
 *
 * Requirements:
 * - Page load < 1 second (100 items)
 * - 100+ concurrent users
 *
 * Uses the optimized /transaction-nodes endpoint (PR #2161)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { THRESHOLDS, DELAYS, HTTP_STATUS } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type { K6Options, MultiUserSetupData, SummaryData, SummaryOutput } from '../types';

// Custom metrics
const dataVolumeOk = new Rate('in_progress_data_volume_ok');

declare const __ENV: Record<string, string | undefined>;
const DEBUG = __ENV.DEBUG === 'true';
// Network parameter - must match the value used when seeding (defaults to mainnet)
const NETWORK = __ENV.HEDERA_NETWORK || 'mainnet';

// Target count for In Progress transactions (same as Ready for Review)
const TARGET_COUNT = 100;

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
    'http_req_duration{name:in-progress}': [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    in_progress_data_volume_ok: ['rate==1'], // Must fetch target volume
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
 * Uses optimized /transaction-nodes endpoint - returns all items in single request
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);

  group('In Progress Page', () => {
    const res = http.get(
      `${BASE_URL}/transaction-nodes?collection=IN_PROGRESS&network=${NETWORK}`,
      { ...headers, tags: { name: 'in-progress' } },
    );

    check(res, {
      'GET /transaction-nodes?collection=IN_PROGRESS → status 200': (r) => r.status === HTTP_STATUS.OK,
      'GET /transaction-nodes?collection=IN_PROGRESS → response < 1s': (r) => r.timings.duration < THRESHOLDS.PAGE_LOAD_MS,
    });

    if (res.status !== HTTP_STATUS.OK) {
      dataVolumeOk.add(false);
      return;
    }

    try {
      const items = JSON.parse(res.body as string) as unknown[];
      const itemCount = items?.length ?? 0;

      const volumeMet = itemCount >= TARGET_COUNT;
      dataVolumeOk.add(volumeMet);

      if (!volumeMet) {
        console.warn(`Volume check failed: got ${itemCount}, expected ${TARGET_COUNT}`);
      }

      if (DEBUG) {
        console.log(`In Progress: ${itemCount} items in ${formatDuration(res.timings.duration)}`);
      }
    } catch {
      dataVolumeOk.add(false);
    }
  });

  sleep(DELAYS.BETWEEN_ITERATIONS);
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'in-progress', 'In Progress');
}
