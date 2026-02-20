/**
 * k6 HTML Reporter
 *
 * Generates colorful HTML reports using benc-uk/k6-reporter.
 * Color-codes thresholds and checks (green=pass, red=fail).
 */

// @ts-expect-error - Remote import handled by k6 runtime
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
// @ts-expect-error - Remote import handled by k6 runtime
import { textSummary as k6TextSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';
import type { SummaryData, SummaryOutput } from '../types';

/**
 * Generate HTML and JSON reports for k6 test results
 *
 * @param data - k6 summary data from handleSummary
 * @param scriptName - Script name used for filename (e.g., 'smoke-test')
 * @param title - Human-readable title for HTML report header
 * @returns SummaryOutput with HTML, JSON, and stdout text
 */
export function generateReport(
  data: SummaryData,
  scriptName: string,
  title: string,
): SummaryOutput {
  return {
    [`reports/k6/${scriptName}.html`]: htmlReport(data, { title }),
    [`reports/k6/${scriptName}.json`]: JSON.stringify(data, null, 2),
    stdout: k6TextSummary(data, { indent: ' ', enableColors: true }),
  };
}
