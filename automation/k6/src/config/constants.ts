/**
 * k6 Performance Testing Constants
 *
 * Centralized configuration values derived from performance requirements.
 */

/**
 * Performance thresholds (milliseconds)
 */
export const THRESHOLDS = {
  PAGE_LOAD_MS: 1000,
  SIGN_ALL_MS: 4000,
  P95_PERCENTILE: 'p(95)',
};

/**
 * Data volume requirements per page
 * Based on performance acceptance criteria
 * Note: Backend max page size is 100, so larger values require pagination
 */
export const DATA_VOLUMES = {
  SIGN_ALL_TRANSACTIONS: 500, // Requires 5 pages (500 txns for scaling test)
  READY_TO_SIGN: 200, // Requires 2 pages
  DRAFTS: 100,
  READY_FOR_REVIEW: 100, // Also used for approve transactions
  CONTACTS: 100,
  ACCOUNTS: 100,
  FILES: 100,
  HISTORY: 500, // Requires 5 pages
  GROUP_SIZE: 500, // Transactions per group for Sign All testing (500 txn scaling)
  COMPLEX_KEY_GROUP_SIZE: 100, // Complex key tests use smaller group (17 sigs per txn)
  READY_FOR_EXECUTION: 100, // Transactions ready to submit to Hedera
};

/**
 * Load testing configuration
 */
export const LOAD_TEST = {
  CONCURRENT_USERS: 100,
};

/**
 * Delays between operations (seconds)
 */
export const DELAYS = {
  BETWEEN_TABS: 0.5,
  BETWEEN_ITERATIONS: 1,
};

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  UNAUTHORIZED: 401,
};

/**
 * Pagination defaults
 * Note: Backend enforces MAX_SIZE limit
 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 100,
  MAX_SIZE: 100, // Backend limit - cannot exceed
};

/**
 * Test user pool for staging rate limiting avoidance.
 * Each test can use a different user to avoid backend rate limits (3 logins/min per email).
 * All emails match cleanup pattern 'k6perf@%' for safe staging cleanup.
 */
export const TEST_USER_POOL = [
  { email: 'k6perf@1.test', password: 'Password123' },
  { email: 'k6perf@2.test', password: 'Password123' },
  { email: 'k6perf@3.test', password: 'Password123' },
  { email: 'k6perf@4.test', password: 'Password123' },
] as const;

/**
 * Signature modes for sign-all tests
 */
export const SIGNATURE_MODES = {
  PRE_SIGNED_BATCH: 'PRE_SIGNED_BATCH',
  API_ONLY: 'API_ONLY',
} as const;

/**
 * Seed marker for identifying test data
 * Used to safely clean up test data without affecting real data
 */
export const SEED_MARKER = 'k6-perf-seed';

/**
 * Complex threshold key configuration
 * Based on Hedera's 0.0.2 account structure
 */
export const COMPLEX_KEY = {
  /** Parent threshold (e.g., 17 for "17 of 29") */
  PARENT_THRESHOLD: 17,
  /** Number of child KeyLists */
  CHILD_COUNT: 29,
  /** Total ED25519 keys (alternating 2 and 3 per child: 15×2 + 14×3 = 72) */
  TOTAL_KEYS: 72,
  /** Minimum signatures to satisfy threshold */
  MIN_SIGNATURES: 17,
  /** Path to stored complex key data */
  DATA_PATH: 'automation/k6/data/complex-keys.json',
} as const;
