/**
 * History Load Test
 *
 * Requirements:
 * - Page load < 1 second (with 500+ items)
 * - 100+ concurrent users
 *
 * Uses the optimized /transaction-nodes endpoint (PR #2161)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { multiUserSetup, getTokenForVU } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { DATA_VOLUMES, THRESHOLDS, DELAYS, HTTP_STATUS } from '../config/constants';
import { STANDARD_LOAD_STAGES, TAB_LOAD_THRESHOLDS } from '../config/load-profiles';
import type {
  K6Options,
  MultiUserSetupData,
  SummaryData,
  SummaryOutput,
} from '../types';

// Custom metrics
const totalDurationTrend = new Trend('history_total_duration');
const dataVolumeOk = new Rate('history_data_volume_ok');

declare const __ENV: Record<string, string | undefined>;
const DEBUG = __ENV.DEBUG === 'true';
// Network parameter - must match the value used when seeding (defaults to mainnet)
const NETWORK = __ENV.HEDERA_NETWORK || 'mainnet';

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
 * Uses optimized /transaction-nodes endpoint - returns all items in single request
 */
export default function (data: MultiUserSetupData): void {
  const token = getTokenForVU(data);
  if (!token) return;

  const headers = authHeaders(token);
  const targetCount = DATA_VOLUMES.HISTORY; // 500

  group('History Page', () => {
    const startTime = Date.now();

    const res = http.get(
      `${BASE_URL}/transaction-nodes?collection=HISTORY&network=${NETWORK}`,
      { ...headers, tags: { name: 'history' } },
    );

    const totalDuration = Date.now() - startTime;
    totalDurationTrend.add(totalDuration);

    check(res, {
      'GET /transaction-nodes?collection=HISTORY → status 200': (r) => r.status === HTTP_STATUS.OK,
    });

    if (res.status !== HTTP_STATUS.OK) {
      dataVolumeOk.add(false);
      return;
    }

    try {
      const items = JSON.parse(res.body as string) as unknown[];
      const itemCount = items?.length ?? 0;

      dataVolumeOk.add(itemCount >= targetCount);

      check(null, {
        'GET /transaction-nodes?collection=HISTORY → response < 1s': () => totalDuration < THRESHOLDS.PAGE_LOAD_MS,
        [`GET /transaction-nodes?collection=HISTORY → fetched ${targetCount}+ items`]: () => itemCount >= targetCount,
      });

      if (DEBUG) console.log(`History: ${itemCount} items in ${formatDuration(totalDuration)}`);
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
  return generateReport(data, 'history', 'History');
}
