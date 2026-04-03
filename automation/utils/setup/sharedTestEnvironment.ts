import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { TestInfo } from '@playwright/test';
import {
  resetDbState,
  resetDbStateForTeardown,
  resetPostgresDbState,
  resetPostgresDbStateForTeardown,
} from '../db/databaseUtil.js';
import {
  applyPlaywrightIsolationEnv,
  clearPlaywrightIsolationEnv,
  type PlaywrightIsolationContext,
} from './playwrightIsolation.js';
import {
  isSharedEnvironmentRun,
  shouldPreserveBackendState,
} from '../runtime/backendStateMode.js';

const SHARED_ENV_ROOT = path.join(os.tmpdir(), 'hedera-transaction-tool-playwright');
const DEFAULT_REMOTE_DEBUGGING_PORT = 9333;
const MAX_LABEL_LENGTH = 63;

export interface ActivatedTestIsolationContext extends PlaywrightIsolationContext {
  rootDir: string;
  scope: 'suite' | 'test';
}

export async function activateSuiteIsolation(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry'>,
): Promise<ActivatedTestIsolationContext | null> {
  return await activateIsolation(testInfo, 'suite');
}

export async function activateTestIsolation(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry' | 'title'>,
): Promise<ActivatedTestIsolationContext | null> {
  return await activateIsolation(testInfo, 'test');
}

export async function cleanupIsolation(context?: ActivatedTestIsolationContext | null) {
  if (!context) {
    return;
  }

  await fsp.rm(context.rootDir, { recursive: true, force: true });
  clearPlaywrightIsolationEnv();
}

export async function resetLocalStateForSuite() {
  if (isSharedEnvironmentRun()) {
    return;
  }

  await resetDbState();
}

export async function resetLocalStateForTeardown() {
  if (isSharedEnvironmentRun()) {
    return;
  }

  await resetDbStateForTeardown();
}

export async function resetBackendStateForSuite() {
  if (shouldPreserveBackendState()) {
    return;
  }

  await resetPostgresDbState();
}

export async function resetBackendStateForTeardown() {
  if (shouldPreserveBackendState()) {
    return;
  }

  await resetPostgresDbStateForTeardown();
}

export function createNamespacedLabel(
  label: string,
  context?: Pick<ActivatedTestIsolationContext, 'namespace'> | null,
): string {
  if (!context) {
    return label;
  }

  const suffix = context.namespace.slice(-12);
  const candidate = `${label} ${suffix}`.trim();

  if (candidate.length <= MAX_LABEL_LENGTH) {
    return candidate;
  }

  const maxLabelLength = Math.max(MAX_LABEL_LENGTH - suffix.length - 1, 1);
  return `${label.slice(0, maxLabelLength)} ${suffix}`.trim();
}

async function activateIsolation(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry'> & Partial<Pick<TestInfo, 'title'>>,
  scope: 'suite' | 'test',
): Promise<ActivatedTestIsolationContext | null> {
  clearPlaywrightIsolationEnv();

  if (!isSharedEnvironmentRun()) {
    return null;
  }

  const runId = resolveRunId();
  const workerIndex = String(testInfo.parallelIndex);
  const fileSlug = sanitize(path.basename(testInfo.file, path.extname(testInfo.file)));
  const retrySuffix = `-r${testInfo.retry}`;
  const titleSlug =
    scope === 'test' && testInfo.title
      ? `-${sanitize(testInfo.title).slice(0, 32)}${retrySuffix}`
      : retrySuffix;
  const namespace = sanitize(`pw-${runId}-${fileSlug}-w${workerIndex}${titleSlug}`);
  const rootDir = path.join(SHARED_ENV_ROOT, namespace);

  process.env.TEST_WORKER_INDEX = workerIndex;
  process.env.PLAYWRIGHT_RUN_ID = runId;
  process.env.PLAYWRIGHT_NAMESPACE = namespace;
  process.env.PLAYWRIGHT_USER_DATA_DIR = path.join(rootDir, 'user-data');
  process.env.PLAYWRIGHT_SESSION_PARTITION = `persist:${namespace}`;
  process.env.PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK = 'true';
  process.env.ELECTRON_REMOTE_DEBUGGING_PORT = String(
    DEFAULT_REMOTE_DEBUGGING_PORT + testInfo.parallelIndex,
  );

  const context = applyPlaywrightIsolationEnv();
  if (!context) {
    return null;
  }

  await fsp.rm(rootDir, { recursive: true, force: true });
  await fsp.mkdir(context.userDataDir, { recursive: true });

  return {
    ...context,
    rootDir,
    scope,
  };
}

function resolveRunId(): string {
  return sanitize(
    process.env.PLAYWRIGHT_RUN_ID?.trim() ??
      process.env.GITHUB_RUN_ID?.trim() ??
      `local-${process.ppid || process.pid}`,
  );
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}
