/**
 * Environment Configuration
 *
 * Defines available environments for k6 performance tests.
 */

import type { Environment, EnvironmentMap, Endpoints } from '../types';
import { PAGINATION } from './constants';

declare const __ENV: Record<string, string | undefined>;

// Network parameter - must match the value used when seeding (defaults to mainnet)
const NETWORK = __ENV.HEDERA_NETWORK || 'mainnet';

/**
 * Available environments for testing
 */
export const ENVIRONMENTS: EnvironmentMap = {
  local: {
    baseUrl: 'http://localhost:3001',
    name: 'Local Development',
  },
  development: {
    baseUrl: __ENV.BASE_URL || '',
    name: 'Development',
  },
  staging: {
    baseUrl: __ENV.BASE_URL || '',
    name: 'Staging',
  },
  prod: {
    baseUrl: '',
    name: 'Production',
  },
};

/**
 * Build optimized transaction-nodes endpoint URL
 * Uses the new /transaction-nodes endpoint (PR #2161) which returns all items in a single request
 */
function buildTransactionNodesEndpoint(collection: string): string {
  return `/transaction-nodes?collection=${collection}&network=${NETWORK}`;
}

/**
 * Build legacy endpoint URL with pagination parameters
 * Note: pageSize is capped at backend MAX_SIZE (100)
 * Used for endpoints that don't have optimized versions
 */
function buildPaginatedEndpoint(
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
 * Uses optimized /transaction-nodes endpoint where available (PR #2161)
 */
export const endpoints: Endpoints = {
  'all-transactions': buildPaginatedEndpoint('/transactions'),
  'history': buildTransactionNodesEndpoint('HISTORY'),
  'in-progress': buildTransactionNodesEndpoint('IN_PROGRESS'),
  'notifications': buildPaginatedEndpoint('/notifications'),
  'ready-for-execution': buildTransactionNodesEndpoint('READY_FOR_EXECUTION'),
  'ready-to-approve': buildTransactionNodesEndpoint('READY_FOR_REVIEW'),
  'ready-to-sign': buildTransactionNodesEndpoint('READY_TO_SIGN'),
};
