/**
 * k6 Test Helpers
 *
 * Authentication, HTTP utilities, and formatting for k6 tests.
 */

import http, { Response } from 'k6/http';
import type { AuthHeaders, AuthResponse } from '../types';
import { HTTP_STATUS, THRESHOLDS } from '../config/constants';

/**
 * Authenticate and return auth token
 */
export function login(
  baseUrl: string,
  email: string,
  password: string,
): string | null {
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'x-frontend-version': '0.22.0',
    },
  };

  const res: Response = http.post(`${baseUrl}/auth/login`, payload, params);

  if (res.status === HTTP_STATUS.OK || res.status === HTTP_STATUS.CREATED) {
    try {
      const body = JSON.parse(res.body as string) as AuthResponse;
      return body.accessToken || null;
    } catch (e) {
      const error = e as Error;
      console.error(`Failed to parse login response: ${error.message}`);
      return null;
    }
  }

  console.error(`Login failed: ${res.status} - ${res.body as string}`);
  return null;
}

/**
 * Create authenticated request headers
 */
export function authHeaders(token: string): AuthHeaders {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-frontend-version': '0.22.0',
    },
  };
}

/**
 * Format duration for logging
 */
export function formatDuration(ms: number): string {
  if (ms < THRESHOLDS.PAGE_LOAD_MS) return `${ms.toFixed(2)}ms`;
  return `${(ms / THRESHOLDS.PAGE_LOAD_MS).toFixed(2)}s`;
}

