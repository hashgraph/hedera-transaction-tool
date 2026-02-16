/**
 * k6 Credentials Management
 *
 * Centralized handling of test credentials via environment variables.
 * Defaults are provided for local development; override via -e flags for other environments.
 */

import { getEnvironment } from './environments';

// k6 environment variables
declare const __ENV: Record<string, string | undefined>;
declare const __VU: number;

// Default test credentials (overridable via USER_EMAIL / USER_PASSWORD env vars)
const DEFAULT_EMAIL = 'k6perf@test.com';
const DEFAULT_PASSWORD = 'Password123';

export interface TestCredentials {
  email: string;
  password: string;
}

/**
 * Get test credentials from environment variables.
 * Falls back to default test credentials if not provided.
 */
export function getCredentials(): TestCredentials {
  return {
    email: __ENV.USER_EMAIL || DEFAULT_EMAIL,
    password: __ENV.USER_PASSWORD || DEFAULT_PASSWORD,
  };
}

/**
 * Get all configured test users for multi-user testing.
 * Supports USER_EMAIL, USER_EMAIL_1, USER_EMAIL_2, etc.
 */
export function getTestUsers(): TestCredentials[] {
  const users: TestCredentials[] = [];

  // Primary user (defaults if not set)
  const primaryEmail = __ENV.USER_EMAIL || DEFAULT_EMAIL;
  const primaryPassword = __ENV.USER_PASSWORD || DEFAULT_PASSWORD;
  users.push({ email: primaryEmail, password: primaryPassword });

  // Additional users (USER_EMAIL_1, USER_EMAIL_2, etc.) - no limit
  for (let i = 1; ; i++) {
    const email = __ENV[`USER_EMAIL_${i}`];
    if (!email) break; // Stop when no more users configured
    const password = __ENV[`USER_PASSWORD_${i}`] || primaryPassword;
    if (password) {
      users.push({ email, password });
    }
  }

  return users;
}

// Cache test users at module load
const TEST_USERS = getTestUsers();

/**
 * Get credentials for current virtual user.
 * Distributes users evenly across VUs to prevent auth conflicts.
 * Throws if no users are configured.
 */
export function getCredentialsForVU(): TestCredentials {
  if (TEST_USERS.length === 0) {
    throw new Error(
      'No test users configured. Set USER_EMAIL and USER_PASSWORD environment variables.',
    );
  }

  // Distribute users across VUs: VU 1 gets user 0, VU 2 gets user 1, etc.
  const userIndex = (__VU - 1) % TEST_USERS.length;
  return TEST_USERS[userIndex];
}

/**
 * Get base URL from environment.
 * Priority: BASE_URL env var > ENV-based lookup > localhost fallback
 *
 * Usage:
 *   k6 run script.js                    # local (default)
 *   k6 run -e ENV=staging script.js     # staging via named environment
 *   k6 run -e BASE_URL='...' script.js  # direct URL override
 */
export function getBaseUrlWithFallback(): string {
  return __ENV.BASE_URL || getEnvironment().baseUrl;
}
