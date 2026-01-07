/**
 * Ready to Sign Performance Test
 *
 * Requirements:
 * - Ready to Sign page load < 1 second (200 items)
 * - 100+ concurrent users
 */

import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { fetchPaginated } from '../lib/pagination';
import { getBaseUrlWithFallback } from '../config/credentials';
import { DATA_VOLUMES, THRESHOLDS, DELAYS } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type {
  K6Options,
  MultiUserSetupData,
  SummaryData,
  SummaryOutput,
  TransactionToSignDto,
} from '../types';

// Custom metrics
const totalDurationTrend = new Trend('ready_to_sign_total_duration');
const dataVolumeOk = new Rate('ready_to_sign_data_volume_ok');

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
    'http_req_duration{name:ready-to-sign}': [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    ready_to_sign_total_duration: [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`],
    ready_to_sign_data_volume_ok: ['rate==1'], // Must fetch target volume
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
 * Fetches 200 items across 2 pages (100 items per page due to backend limit)
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);
  const targetCount = DATA_VOLUMES.READY_TO_SIGN; // 200

  group('Ready to Sign Page', () => {
    const result = fetchPaginated<TransactionToSignDto>({
      buildUrl: (page, size) => `${BASE_URL}/transactions/sign?page=${page}&size=${size}`,
      headers,
      targetCount,
      tagName: 'ready-to-sign',
      checkName: 'ready-to-sign',
    });

    totalDurationTrend.add(result.totalDuration);
    dataVolumeOk.add(result.totalItems >= targetCount);

    check(null, {
      'ready-to-sign total time < 1s': () => result.totalDuration < THRESHOLDS.PAGE_LOAD_MS,
      [`fetched ${targetCount}+ items`]: () => result.totalItems >= targetCount,
    });

    if (DEBUG)
      console.log(`Ready to Sign: ${result.totalItems} items in ${formatDuration(result.totalDuration)}`);
  });

  sleep(DELAYS.BETWEEN_ITERATIONS);
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'ready-to-sign', 'Ready to Sign');
}
