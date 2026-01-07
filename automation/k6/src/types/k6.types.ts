/**
 * k6-specific Types
 *
 * Types for k6 runtime values and summary data.
 */

/**
 * Setup data passed to default function (single user)
 */
export interface SetupData {
  token: string | null;
}

/**
 * Multi-user setup data for load tests
 * Contains array of authenticated users for distribution across VUs
 */
export interface MultiUserSetupData {
  users: Array<{ email: string; token: string }>;
}

/**
 * k6 metric values in summary data
 */
export interface MetricValues {
  avg: number;
  min: number;
  max: number;
  med: number;
  'p(90)': number;
  'p(95)': number;
  'p(99)': number;
  count?: number;
  rate?: number;
}

/**
 * Single metric in summary data
 */
export interface SummaryMetric {
  type: string;
  contains: string;
  values: MetricValues;
}

/**
 * k6 summary data passed to handleSummary
 */
export interface SummaryData {
  metrics: Record<string, SummaryMetric>;
  root_group: GroupSummary;
  state: {
    isStdOutTTY: boolean;
    isStdErrTTY: boolean;
    testRunDurationMs: number;
  };
}

/**
 * Group summary data
 */
export interface GroupSummary {
  name: string;
  path: string;
  id: string;
  groups: GroupSummary[];
  checks: CheckSummary[];
}

/**
 * Check summary data
 */
export interface CheckSummary {
  name: string;
  path: string;
  id: string;
  passes: number;
  fails: number;
}

/**
 * Metric property mapping for formatDataMetrics
 */
export interface MetricPropertyMap {
  [key: string]: string;
}

/**
 * handleSummary return type
 */
export interface SummaryOutput {
  [outputPath: string]: string | undefined;
}
