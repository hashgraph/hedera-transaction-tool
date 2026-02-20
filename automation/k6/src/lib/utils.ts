/**
 * k6 Reporting Utilities
 *
 * Helpers for formatting k6 metrics and generating reports.
 */

import type { SummaryData, MetricPropertyMap } from '../types';

/**
 * Rename metric properties in summary data for cleaner reports
 */
export function formatDataMetrics(
  data: SummaryData,
  fields: MetricPropertyMap,
): void {
  for (const property in fields) {
    if (data.metrics[property]) {
      data.metrics[fields[property]] = data.metrics[property];
      delete data.metrics[property];
    }
  }
}

/**
 * Standard metric property mappings for HTML reports
 * Maps k6 internal metric names to human-readable labels
 */
export const needed_properties: MetricPropertyMap = {
  // Core HTTP timing metrics (ms)
  'http_req_blocked': 'Blocked Time (ms)',
  'http_req_connecting': 'Connection Time (ms)',
  'http_req_duration': 'Total Request Time (ms)',
  'http_req_receiving': 'Download Time (ms)',
  'http_req_sending': 'Upload Time (ms)',
  'http_req_tls_handshaking': 'TLS Handshake (ms)',
  'http_req_waiting': 'Server Wait Time / TTFB (ms)',
  'http_req_failed': 'Failed Requests',

  // Tagged HTTP durations per-endpoint (ms)
  'http_req_duration{name:sign-transaction}': 'Sign Transaction Time (ms)',
  'http_req_duration{name:ready-to-sign}': 'Ready to Sign Time (ms)',
  'http_req_duration{name:all-transactions}': 'All Transactions Time (ms)',
  'http_req_duration{name:history}': 'History Time (ms)',
  'http_req_duration{name:notifications}': 'Notifications Time (ms)',
  'http_req_duration{name:ready-to-approve}': 'Ready to Approve Time (ms)',

  // Test execution metrics (ms)
  'iteration_duration': 'Iteration Duration (ms)',
  'group_duration': 'Group Duration (ms)',

  // Tab performance metrics (ms)
  'tab_ready_to_sign_duration': 'Ready to Sign Tab (ms)',
  'tab_ready_to_approve_duration': 'Ready to Approve Tab (ms)',
  'tab_in_progress_duration': 'In Progress Tab (ms)',
  'tab_ready_for_execution_duration': 'Ready for Execution Tab (ms)',
  'tab_all_transactions_duration': 'All Transactions Tab (ms)',
  'tab_history_duration': 'History Tab (ms)',
  'tab_notifications_duration': 'Notifications Tab (ms)',
  'tab_ready_to_sign_total_duration': 'Ready to Sign Total (ms)',
  'tab_history_total_duration': 'History Total (ms)',
  'tab_ready_to_sign_volume_ok': 'Ready to Sign Volume OK',
  'tab_history_volume_ok': 'History Volume OK',
  'tab_load_success': 'Tab Load Success',

  // Sign All metrics
  'sign_all_duration': 'Sign All Duration (ms)',
  'upload_signature_duration': 'Upload Signature Time (ms)',
  'transactions_processed': 'Transactions Processed',
  'upload_success_rate': 'Upload Success Rate',

  // History metrics
  'history_total_duration': 'History Total Duration (ms)',
  'history_data_volume_ok': 'History Data Volume OK',

  // Ready to Sign metrics
  'ready_to_sign_total_duration': 'Ready to Sign Total Duration (ms)',
  'ready_to_sign_data_volume_ok': 'Ready to Sign Data Volume OK',

  // Ready to Approve metrics
  'ready_to_approve_data_volume_ok': 'Ready to Approve Data Volume OK',

  // Check results
  'GET /transaction-nodes?collection=READY_TO_SIGN → status 200': 'Ready to Sign Status OK',
  'GET /transaction-nodes?collection=READY_TO_SIGN → response < 1s': 'Ready to Sign Under 1s',
};

