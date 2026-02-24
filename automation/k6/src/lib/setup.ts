/**
 * k6 Setup Functions
 *
 * Shared setup and teardown functions for k6 tests.
 */

import { fail } from 'k6';
import { login } from './helpers';
import { getCredentials, getTestUsers, getBaseUrlWithFallback } from '../config/credentials';
import type { SetupData, MultiUserSetupData } from '../types/k6.types';

// k6 environment variables
declare const __VU: number;

/**
 * Standard setup function for k6 tests.
 * Authenticates using USER_EMAIL and USER_PASSWORD environment variables.
 *
 * @param baseUrl - API base URL (defaults to BASE_URL env var or localhost)
 * @returns SetupData with auth token
 */
export function standardSetup(baseUrl?: string): SetupData {
  const url = baseUrl || getBaseUrlWithFallback();
  const { email, password } = getCredentials();
  const token = login(url, email, password);

  if (!token) {
    fail('Authentication failed - check USER_EMAIL and USER_PASSWORD');
  }

  return { token };
}

/**
 * Multi-user setup function for load tests.
 * Authenticates ALL configured test users upfront and returns array of tokens.
 * Each VU then picks their assigned token via getTokenForVU().
 *
 * @param baseUrl - API base URL (defaults to BASE_URL env var or localhost)
 * @returns MultiUserSetupData with array of authenticated users
 */
export function multiUserSetup(baseUrl?: string): MultiUserSetupData {
  const url = baseUrl || getBaseUrlWithFallback();
  const testUsers = getTestUsers();

  if (testUsers.length === 0) {
    fail('No test users configured. Set USER_EMAIL/USER_PASSWORD environment variables.');
  }

  const authenticatedUsers: Array<{ email: string; token: string }> = [];

  for (const user of testUsers) {
    const token = login(url, user.email, user.password);
    if (token) {
      authenticatedUsers.push({ email: user.email, token });
    } else {
      console.warn(`Failed to authenticate user: ${user.email}`);
    }
  }

  console.log(`Authenticated ${authenticatedUsers.length}/${testUsers.length} users`);

  if (authenticatedUsers.length === 0) {
    fail('No users authenticated successfully. Check credentials and API availability.');
  }

  return { users: authenticatedUsers };
}

/**
 * Get token for current VU from multi-user setup data.
 * Distributes users evenly across VUs via round-robin.
 *
 * @param data - MultiUserSetupData from multiUserSetup()
 * @returns Auth token for the current VU, or null if no users
 */
export function getTokenForVU(data: MultiUserSetupData): string | null {
  if (!data.users || data.users.length === 0) {
    return null;
  }

  const vuId = __VU || 1;
  const index = (vuId - 1) % data.users.length;
  return data.users[index]?.token || null;
}
