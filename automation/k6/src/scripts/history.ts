/**
 * History Load Test
 *
 * Requirements:
 * - Page load < 1 second (with 500+ items)
 * - 100+ concurrent users
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { DATA_VOLUMES, THRESHOLDS, DELAYS, HTTP_STATUS, PAGINATION } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type {
  K6Options,
  MultiUserSetupData,
  SummaryData,
  SummaryOutput,
  PaginatedResponse,
  Transaction,
} from '../types';

// Custom metrics
const totalDurationTrend = new Trend('history_total_duration');
const dataVolumeOk = new Rate('history_data_volume_ok');

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
    'http_req_duration{name:history}': [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    history_total_duration: [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    history_data_volume_ok: ['rate==1'], // Must fetch target volume
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
 * Fetches 500 items across 5 pages (100 items per page due to backend limit)
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);

  group('History Page', () => {
    const startTime = Date.now();
    let totalItems = 0;
    const targetCount = DATA_VOLUMES.HISTORY; // 500
    const pagesNeeded = Math.ceil(targetCount / PAGINATION.MAX_SIZE); // 5

    for (let page = 1; page <= pagesNeeded; page++) {
      const res = http.get(
        `${BASE_URL}/transactions/history?page=${page}&size=${PAGINATION.MAX_SIZE}`,
        { ...headers, tags: { name: 'history' } },
      );

      check(res, {
        [`history page ${page} status 200`]: (r) => r.status === HTTP_STATUS.OK,
      });

      if (res.status !== HTTP_STATUS.OK) {
        break;
      }

      try {
        const body = JSON.parse(res.body as string) as PaginatedResponse<Transaction>;
        totalItems += body.items.length;

        if (body.items.length < PAGINATION.MAX_SIZE) break;
      } catch {
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    totalDurationTrend.add(totalDuration);
    dataVolumeOk.add(totalItems >= targetCount);

    check(null, {
      'history total time < 1s': () => totalDuration < THRESHOLDS.PAGE_LOAD_MS,
      [`fetched ${targetCount}+ items`]: () => totalItems >= targetCount,
    });

    if (DEBUG) console.log(`History: ${totalItems} items in ${formatDuration(totalDuration)}`);
  });

  sleep(DELAYS.BETWEEN_ITERATIONS);
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'history', 'History');
}
