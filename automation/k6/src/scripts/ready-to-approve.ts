/**
 * Ready to Approve Load Test
 *
 * Requirements:
 * - Page load < 1 second (100 items)
 * - 100+ concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { DATA_VOLUMES, THRESHOLDS, DELAYS, HTTP_STATUS, PAGINATION } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type { K6Options, MultiUserSetupData, SummaryData, SummaryOutput } from '../types';

// Custom metrics
const dataVolumeOk = new Rate('ready_to_approve_data_volume_ok');

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
    'http_req_duration{name:ready-to-approve}': [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    ready_to_approve_data_volume_ok: ['rate==1'], // Must fetch target volume
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
 * Fetches 100 items (fits in single page since MAX_SIZE=100)
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);
  const targetCount = DATA_VOLUMES.READY_FOR_REVIEW; // 100

  group('Ready to Approve Page', () => {
    const res = http.get(
      `${BASE_URL}/transactions/approve?page=1&size=${PAGINATION.MAX_SIZE}`,
      { ...headers, tags: { name: 'ready-to-approve' } },
    );

    check(res, {
      'ready-to-approve status 200': (r) => r.status === HTTP_STATUS.OK,
      'ready-to-approve response < 1s': (r) => r.timings.duration < THRESHOLDS.PAGE_LOAD_MS,
    });

    if (res.status !== HTTP_STATUS.OK) {
      dataVolumeOk.add(false);
      return;
    }

    try {
      const body = JSON.parse(res.body as string) as { items: unknown[] };
      const itemCount = body.items?.length ?? 0;

      const volumeMet = itemCount >= targetCount;
      dataVolumeOk.add(volumeMet);

      if (!volumeMet) {
        console.warn(`Volume check failed: got ${itemCount}, expected ${targetCount}`);
      }

      if (DEBUG) {
        console.log(`Ready to Approve: ${itemCount} items in ${formatDuration(res.timings.duration)}`);
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
  return generateReport(data, 'ready-to-approve', 'Ready to Approve');
}
