/**
 * Environment Configuration
 *
 * Defines available environments for k6 performance tests.
 */

import type { Environment, EnvironmentMap, Endpoints } from '../types';
import { PAGINATION, DATA_VOLUMES } from './constants';

declare const __ENV: Record<string, string | undefined>;

/**
 * Available environments for testing
 */
export const ENVIRONMENTS: EnvironmentMap = {
  local: {
    baseUrl: 'http://localhost:3001',
    name: 'Local Development',
  },
  staging: {
    baseUrl: 'https://staging-transaction-tool.swirldslabs-devops.com',
    name: 'Staging',
  },
  prod: {
    baseUrl: '',
    name: 'Production',
  },
};

/**
 * Build endpoint URL with pagination parameters
 * Note: pageSize is capped at backend MAX_SIZE (100)
 */
function buildEndpoint(
  path: string,
  pageSize: number = PAGINATION.DEFAULT_SIZE,
  filter?: string,
): string {
  const size = Math.min(pageSize, PAGINATION.MAX_SIZE);
  let url = `${path}?page=${PAGINATION.DEFAULT_PAGE}&size=${size}`;
  if (filter) url += `&filter=${encodeURIComponent(filter)}`;
  return url;
}

/**
 * Get environment configuration based on ENV variable
 */
export function getEnvironment(): Environment {
  const envName = __ENV.ENV || 'local';
  const env = ENVIRONMENTS[envName];

  if (!env) {
    console.error(
      `Unknown environment: ${envName}. Available: ${Object.keys(ENVIRONMENTS).join(', ')}`,
    );
    return ENVIRONMENTS.local;
  }

  return env;
}

/**
 * API endpoints for page load tests
 * Page sizes based on performance requirements
 */
export const endpoints: Endpoints = {
  'all-transactions': buildEndpoint('/transactions'),
  'history': buildEndpoint('/transactions/history', DATA_VOLUMES.HISTORY),
  'in-progress': buildEndpoint('/transactions', PAGINATION.DEFAULT_SIZE, 'status:in:WAITING FOR SIGNATURES'),
  'notifications': buildEndpoint('/notifications'),
  'ready-for-execution': buildEndpoint('/transactions', PAGINATION.DEFAULT_SIZE, 'status:in:WAITING FOR EXECUTION'),
  'ready-to-approve': buildEndpoint('/transactions/approve'),
  'ready-to-sign': buildEndpoint('/transactions/sign', DATA_VOLUMES.READY_TO_SIGN),
};
