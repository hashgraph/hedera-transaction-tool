/**
 * Tab Load Times Performance Test
 *
 * Baseline test for all main UI tabs.
 * Measures API response times for each tab's data endpoint.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { authHeaders } from '../lib/helpers';
import { standardSetup } from '../lib/setup';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { generateReport } from '../lib/reporter';
import { getBaseUrlWithFallback } from '../config/credentials';
import { endpoints } from '../config/environments';
import { THRESHOLDS, DELAYS, HTTP_STATUS, DATA_VOLUMES, PAGINATION } from '../config/constants';
import type {
  K6Options,
  SetupData,
  SummaryData,
  SummaryOutput,
  TabConfig,
  PaginatedResponse,
  Transaction,
  TransactionToSignDto,
} from '../types';

// Custom metrics per tab
const readyToSignDuration = new Trend('tab_ready_to_sign_duration');
const readyToApproveDuration = new Trend('tab_ready_to_approve_duration');
const inProgressDuration = new Trend('tab_in_progress_duration');
const readyForExecutionDuration = new Trend('tab_ready_for_execution_duration');
const allTransactionsDuration = new Trend('tab_all_transactions_duration');
const historyDuration = new Trend('tab_history_duration');
const notificationsDuration = new Trend('tab_notifications_duration');

// Total duration trends for multi-page tabs
const readyToSignTotalDuration = new Trend('tab_ready_to_sign_total_duration');
const historyTotalDuration = new Trend('tab_history_total_duration');

// Data volume Rate metrics (for hard fail on missing data)
const readyToSignVolumeOk = new Rate('tab_ready_to_sign_volume_ok');
const historyVolumeOk = new Rate('tab_history_volume_ok');

const tabLoadSuccess = new Rate('tab_load_success');

// Threshold string for all tabs
const tabThreshold = [`${THRESHOLDS.P95_PERCENTILE}<${THRESHOLDS.PAGE_LOAD_MS}`];

/**
 * k6 options configuration
 */
export const options: K6Options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '2m',
      tags: { scenario: 'baseline' },
    },
  },
  thresholds: {
    tab_ready_to_sign_duration: tabThreshold,
    tab_ready_to_approve_duration: tabThreshold,
    tab_in_progress_duration: tabThreshold,
    tab_ready_for_execution_duration: tabThreshold,
    tab_all_transactions_duration: tabThreshold,
    tab_history_duration: tabThreshold,
    tab_notifications_duration: tabThreshold,
    // Total duration for multi-page tabs (200/500 items)
    tab_ready_to_sign_total_duration: tabThreshold,
    tab_history_total_duration: tabThreshold,
    // Data volume enforcement
    tab_ready_to_sign_volume_ok: ['rate==1'],
    tab_history_volume_ok: ['rate==1'],
    tab_load_success: ['rate>0.99'],
  },
};

const BASE_URL = getBaseUrlWithFallback();

const TABS: TabConfig[] = [
  {
    name: 'Ready to Sign',
    endpoint: endpoints['ready-to-sign'],
    metric: readyToSignDuration,
    tag: 'ready-to-sign',
  },
  {
    name: 'Ready to Approve',
    endpoint: endpoints['ready-to-approve'],
    metric: readyToApproveDuration,
    tag: 'ready-to-approve',
  },
  {
    name: 'In Progress',
    endpoint: endpoints['in-progress'],
    metric: inProgressDuration,
    tag: 'in-progress',
  },
  {
    name: 'Ready for Execution',
    endpoint: endpoints['ready-for-execution'],
    metric: readyForExecutionDuration,
    tag: 'ready-for-execution',
  },
  {
    name: 'All Transactions',
    endpoint: endpoints['all-transactions'],
    metric: allTransactionsDuration,
    tag: 'all-transactions',
  },
  {
    name: 'History',
    endpoint: endpoints['history'],
    metric: historyDuration,
    tag: 'history',
  },
  {
    name: 'Notifications',
    endpoint: endpoints['notifications'],
    metric: notificationsDuration,
    tag: 'notifications',
  },
];

/**
 * Setup function - authenticates and returns token
 */
export function setup(): SetupData {
  const data = standardSetup(BASE_URL);
  if (data.token) {
    console.log('Authentication successful');
  }
  return data;
}

/**
 * Fetch paginated data for Ready to Sign tab (200 items across 2 pages)
 */
function fetchReadyToSign(headers: ReturnType<typeof authHeaders>): void {
  group('Ready to Sign', () => {
    const startTime = Date.now();
    let totalItems = 0;
    const targetCount = DATA_VOLUMES.READY_TO_SIGN;
    const pagesNeeded = Math.ceil(targetCount / PAGINATION.MAX_SIZE);

    for (let page = 1; page <= pagesNeeded; page++) {
      const res = http.get(
        `${BASE_URL}/transactions/sign?page=${page}&size=${PAGINATION.MAX_SIZE}`,
        { ...headers, tags: { name: 'ready-to-sign' } },
      );

      const success = res.status === HTTP_STATUS.OK;
      tabLoadSuccess.add(success);
      readyToSignDuration.add(res.timings.duration);

      check(res, {
        [`Ready to Sign page ${page} status 200`]: () => res.status === HTTP_STATUS.OK,
      });

      if (!success) break;

      try {
        const body = JSON.parse(res.body as string) as PaginatedResponse<TransactionToSignDto>;
        totalItems += body.items.length;
        if (body.items.length < PAGINATION.MAX_SIZE) break;
      } catch {
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    readyToSignTotalDuration.add(totalDuration);
    readyToSignVolumeOk.add(totalItems >= targetCount);

    check(null, {
      'Ready to Sign total time < 1s': () => totalDuration < THRESHOLDS.PAGE_LOAD_MS,
      [`Ready to Sign fetched ${targetCount}+ items`]: () => totalItems >= targetCount,
    });
  });
}

/**
 * Fetch paginated data for History tab (500 items across 5 pages)
 */
function fetchHistory(headers: ReturnType<typeof authHeaders>): void {
  group('History', () => {
    const startTime = Date.now();
    let totalItems = 0;
    const targetCount = DATA_VOLUMES.HISTORY;
    const pagesNeeded = Math.ceil(targetCount / PAGINATION.MAX_SIZE);

    for (let page = 1; page <= pagesNeeded; page++) {
      const res = http.get(
        `${BASE_URL}/transactions/history?page=${page}&size=${PAGINATION.MAX_SIZE}`,
        { ...headers, tags: { name: 'history' } },
      );

      const success = res.status === HTTP_STATUS.OK;
      tabLoadSuccess.add(success);
      historyDuration.add(res.timings.duration);

      check(res, {
        [`History page ${page} status 200`]: () => res.status === HTTP_STATUS.OK,
      });

      if (!success) break;

      try {
        const body = JSON.parse(res.body as string) as PaginatedResponse<Transaction>;
        totalItems += body.items.length;
        if (body.items.length < PAGINATION.MAX_SIZE) break;
      } catch {
        break;
      }
    }

    const totalDuration = Date.now() - startTime;
    historyTotalDuration.add(totalDuration);
    historyVolumeOk.add(totalItems >= targetCount);

    check(null, {
      'History total time < 1s': () => totalDuration < THRESHOLDS.PAGE_LOAD_MS,
      [`History fetched ${targetCount}+ items`]: () => totalItems >= targetCount,
    });
  });
}

/**
 * Main test function - tests each tab
 */
export default function (data: SetupData): void {
  const { token } = data;
  if (!token) {
    console.error('No auth token - skipping iteration');
    return;
  }

  const headers = authHeaders(token);

  // Test each tab - special handling for multi-page tabs
  TABS.forEach((tab) => {
    // Skip Ready to Sign and History - handled separately with multi-page
    if (tab.tag === 'ready-to-sign' || tab.tag === 'history') {
      return;
    }

    group(tab.name, () => {
      const res = http.get(`${BASE_URL}${tab.endpoint}`, {
        ...headers,
        tags: { name: tab.tag },
      });

      const success = res.status === HTTP_STATUS.OK;
      tabLoadSuccess.add(success);
      tab.metric.add(res.timings.duration);

      check(res, {
        [`${tab.name} status 200`]: (r) => r.status === HTTP_STATUS.OK,
        [`${tab.name} response < 1s`]: (r) => r.timings.duration < THRESHOLDS.PAGE_LOAD_MS,
      });

      if (!success) {
        const body = typeof res.body === 'string' ? res.body : '';
        console.warn(`${tab.name} failed: ${res.status} - ${body}`);
      }
    });

    sleep(DELAYS.BETWEEN_TABS);
  });

  // Multi-page tabs: Ready to Sign (200 items) and History (500 items)
  fetchReadyToSign(headers);
  sleep(DELAYS.BETWEEN_TABS);

  fetchHistory(headers);
  sleep(DELAYS.BETWEEN_TABS);

  sleep(DELAYS.BETWEEN_ITERATIONS);
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'tab-load-times', 'Tab Load Times');
}
