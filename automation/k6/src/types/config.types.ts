/**
 * Configuration Types
 *
 * Types for k6 test configuration - environments, options, and thresholds.
 */

/**
 * Environment configuration
 */
export interface Environment {
  baseUrl: string;
  name: string;
}

/**
 * Map of available environments
 */
export interface EnvironmentMap {
  [key: string]: Environment;
  local: Environment;
  staging: Environment;
  prod: Environment;
}

/**
 * k6 load test stage configuration
 */
export interface LoadStage {
  duration: string;
  target: number;
}

/**
 * k6 threshold configuration
 */
export type ThresholdValue = string[];

export interface Thresholds {
  [metricName: string]: ThresholdValue;
}

/**
 * k6 scenario configuration
 */
export interface Scenario {
  executor: string;
  vus?: number;
  duration?: string;
  iterations?: number;
  maxDuration?: string;
  startVUs?: number;
  stages?: LoadStage[];
  tags?: Record<string, string>;
}

/**
 * k6 options configuration
 */
export interface K6Options {
  vus?: number;
  duration?: string;
  stages?: LoadStage[];
  scenarios?: Record<string, Scenario>;
  thresholds?: Thresholds;
}

/**
 * API endpoints configuration
 */
export interface Endpoints {
  'all-transactions': string;
  'history': string;
  'in-progress': string;
  'notifications': string;
  'ready-for-execution': string;
  'ready-to-approve': string;
  'ready-to-sign': string;
}

/**
 * Tab configuration for load tests
 */
export interface TabConfig {
  name: string;
  endpoint: string;
  metric: import('k6/metrics').Trend;
  tag: string;
}
