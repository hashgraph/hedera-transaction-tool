/**
 * Sign All Transactions Performance Test
 *
 * This test measures the API upload time for pre-signed transactions.
 * Signatures are generated beforehand using the Node.js helper:
 *   tsx k6/helpers/sign-transactions.ts
 *
 * Two modes:
 * 1. PRE_SIGNED_FILE - Load signatures from JSON file (recommended)
 * 2. API_ONLY - Fetch transactions and measure GET/POST without real signatures
 */

import http from 'k6/http';
import { check, group, fail } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { authHeaders, formatDuration } from '../lib/helpers';
import { generateReport } from '../lib/reporter';
import { formatDataMetrics, needed_properties } from '../lib/utils';
import { standardSetup } from '../lib/setup';
import { getBaseUrlWithFallback } from '../config/credentials';
import { DATA_VOLUMES, THRESHOLDS, HTTP_STATUS, PAGINATION, SIGNATURE_MODES } from '../config/constants';
import type {
  K6Options,
  SetupData,
  SummaryData,
  SummaryOutput,
  Transaction,
  TransactionToSignDto,
  PaginatedResponse,
  PreSignedData,
} from '../types';

declare const __ENV: Record<string, string | undefined>;
declare function open(filePath: string): string;

// Debug mode - gate verbose logging
const DEBUG = __ENV.DEBUG === 'true';

// Custom metrics
const signAllDuration = new Trend('sign_all_duration');
const uploadSignatureDuration = new Trend('upload_signature_duration');
const transactionsProcessed = new Counter('transactions_processed');
const uploadSuccess = new Rate('upload_success_rate');

// Configuration from constants
const BASE_URL = getBaseUrlWithFallback();
// Default to generated signatures file from seed-perf-data.ts
// Path is relative to dist/ directory where compiled script runs
// Override with SIGNATURES_FILE env var if needed
const SIGNATURES_FILE = __ENV.SIGNATURES_FILE || '../data/signatures.json';

// Load pre-signed signatures if file provided
let preSignedData: PreSignedData | null = null;
if (SIGNATURES_FILE) {
  try {
    preSignedData = JSON.parse(open(SIGNATURES_FILE)) as PreSignedData;
    console.log(
      `Loaded ${preSignedData.count || preSignedData.signatureCount} pre-signed transactions`,
    );
  } catch {
    console.warn(`Could not load signatures file: ${SIGNATURES_FILE}`);
    console.warn('Running in API_ONLY mode (no real signatures)');
  }
}

/**
 * k6 options configuration
 */
export const options: K6Options = {
  scenarios: {
    signAll: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '5m',
    },
  },
  thresholds: {
    sign_all_duration: [`p(95)<${THRESHOLDS.SIGN_ALL_MS}`],
    upload_success_rate: ['rate>0.99'],
  },
};

interface SignaturePayload {
  id: number;
  signatureMap: Record<string, unknown>;
}

interface FetchResult {
  transactions: Transaction[];
  success: boolean;
}

interface SubmitResult {
  successCount: number;
  duration: number;
}

/**
 * Fetch transactions to sign with pagination
 */
function fetchTransactionsToSign(
  headers: ReturnType<typeof authHeaders>,
  targetCount: number,
): FetchResult {
  const transactions: Transaction[] = [];
  const pagesNeeded = Math.ceil(targetCount / PAGINATION.MAX_SIZE);

  for (let page = 1; page <= pagesNeeded; page++) {
    const res = http.get(
      `${BASE_URL}/transactions/sign?page=${page}&size=${PAGINATION.MAX_SIZE}`,
      { ...headers, tags: { name: 'list-to-sign' } },
    );

    const success = check(res, {
      [`list transactions page ${page} status 200`]: (r) => r.status === HTTP_STATUS.OK,
    });

    if (!success) {
      console.error(`Failed to list transactions page ${page}: ${res.status}`);
      return { transactions, success: false };
    }

    try {
      const body = JSON.parse(res.body as string) as PaginatedResponse<TransactionToSignDto>;
      const txItems = body.items.map((item) => item.transaction);
      transactions.push(...txItems);

      if (transactions.length >= targetCount || body.items.length < PAGINATION.MAX_SIZE) {
        break;
      }
    } catch (e) {
      console.error(`Failed to parse response: ${(e as Error).message}`);
      return { transactions, success: false };
    }
  }

  return { transactions, success: true };
}

/**
 * Build signature payloads by matching transactions to pre-signed data
 */
function buildSignaturePayloads(
  transactions: Transaction[],
  signedData: PreSignedData,
  txCount: number,
): SignaturePayload[] {
  const payloads: SignaturePayload[] = [];

  for (let i = 0; i < Math.min(transactions.length, txCount); i++) {
    const tx = transactions[i];
    const key = tx.transactionId ?? String(tx.id);
    const signatureMap =
      signedData.signaturesByTxId?.[key] ||
      signedData.signatures?.[i] ||
      signedData.transactions?.[i]?.signatureMap;

    if (!signatureMap || Object.keys(signatureMap).length === 0) {
      if (DEBUG) console.warn(`No signature found for tx ${tx.id} (key: ${key})`);
      continue;
    }

    payloads.push({ id: tx.id, signatureMap });
  }

  return payloads;
}

/**
 * Submit batch signatures (PRE_SIGNED mode)
 */
function submitBatchSignatures(
  payloads: SignaturePayload[],
  headers: ReturnType<typeof authHeaders>,
): SubmitResult {
  if (DEBUG) console.log(`Submitting ${payloads.length} signatures`);

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/transactions/signers`, JSON.stringify(payloads), {
    ...headers,
    tags: { name: 'batch-sign' },
  });

  const success = res.status === HTTP_STATUS.OK || res.status === HTTP_STATUS.CREATED;
  uploadSuccess.add(success);
  uploadSignatureDuration.add(res.timings.duration);

  if (success) {
    transactionsProcessed.add(payloads.length);
    return { successCount: payloads.length, duration: Date.now() - startTime };
  }

  console.error(`Batch upload failed: ${res.status}`);
  if (DEBUG) {
    const body = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    console.error(`Response: ${body}`);
  }
  return { successCount: 0, duration: Date.now() - startTime };
}

/**
 * Measure API performance without real signatures (API_ONLY mode)
 */
function measureApiOnly(
  transactions: Transaction[],
  headers: ReturnType<typeof authHeaders>,
  txCount: number,
): SubmitResult {
  const startTime = Date.now();
  let successCount = 0;

  for (let i = 0; i < txCount; i++) {
    const tx = transactions[i];
    const res = http.get(`${BASE_URL}/transactions/${tx.id}`, {
      ...headers,
      tags: { name: 'get-transaction' },
    });

    uploadSignatureDuration.add(res.timings.duration);

    if (res.status === HTTP_STATUS.OK) {
      successCount++;
      transactionsProcessed.add(1);
      uploadSuccess.add(true);
    } else {
      uploadSuccess.add(false);
    }
  }

  return { successCount, duration: Date.now() - startTime };
}

/**
 * Log test results summary
 */
function logResults(mode: string, successCount: number, txCount: number, duration: number): void {
  console.log('\n--- Sign All Results ---');
  console.log(`Mode: ${mode}`);
  console.log(`Transactions: ${successCount}/${txCount}`);
  console.log(`Total time: ${formatDuration(duration)}`);
  console.log(`Target: ${formatDuration(THRESHOLDS.SIGN_ALL_MS)}`);
  console.log(`Status: ${duration <= THRESHOLDS.SIGN_ALL_MS ? 'PASS' : 'FAIL'}`);
}

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
 * Main test function - signs all transactions
 */
export default function (data: SetupData): void {
  const { token } = data;
  if (!token) {
    console.error('No auth token - aborting test');
    return;
  }

  const headers = authHeaders(token);

  group('Sign All Transactions', () => {
    if (DEBUG) console.log('Fetching transactions to sign...');

    const targetCount = DATA_VOLUMES.SIGN_ALL_TRANSACTIONS;
    const { transactions } = fetchTransactionsToSign(headers, targetCount);
    const txCount = Math.min(transactions.length, targetCount);

    if (DEBUG) console.log(`Found ${transactions.length} transactions, processing ${txCount}`);

    if (txCount === 0) {
      console.warn('No transactions to sign - need to seed data first');
      return;
    }

    let result: SubmitResult;
    let mode: string;

    if (preSignedData) {
      mode = SIGNATURE_MODES.PRE_SIGNED_BATCH;
      const payloads = buildSignaturePayloads(transactions, preSignedData, txCount);

      if (payloads.length < txCount) {
        fail(
          `Missing signatures: ${payloads.length}/${txCount}. ` +
            `Ensure signaturesByTxId keys match tx.transactionId`,
        );
      }

      result = submitBatchSignatures(payloads, headers);
    } else {
      mode = SIGNATURE_MODES.API_ONLY;
      result = measureApiOnly(transactions, headers, txCount);
    }

    signAllDuration.add(result.duration);
    logResults(mode, result.successCount, txCount, result.duration);

    check(null, {
      [`process ${txCount} transactions under ${THRESHOLDS.SIGN_ALL_MS}ms`]: () =>
        result.duration <= THRESHOLDS.SIGN_ALL_MS,
      'all transactions processed successfully': () => result.successCount === txCount,
    });
  });
}

/**
 * Generate summary report
 */
export function handleSummary(data: SummaryData): SummaryOutput {
  formatDataMetrics(data, needed_properties);
  return generateReport(data, 'sign-all', 'Sign All Transactions');
}
