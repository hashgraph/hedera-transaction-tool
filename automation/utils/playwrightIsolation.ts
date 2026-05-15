import * as os from 'os';
import * as path from 'path';

const DEFAULT_ISOLATION_ROOT = path.join(os.tmpdir(), 'hedera-transaction-tool-playwright');
const DEFAULT_REMOTE_DEBUGGING_PORT = 9333;

export interface PlaywrightIsolationContext {
  namespace: string;
  remoteDebuggingPort: string;
  runId: string;
  sessionPartition: string;
  userDataDir: string;
  workerIndex: string;
}

let cachedContext: PlaywrightIsolationContext | null | undefined;

export function getPlaywrightIsolationContext(): PlaywrightIsolationContext | null {
  if (cachedContext !== undefined) {
    return cachedContext;
  }

  const explicitUserDataDir = readEnv('PLAYWRIGHT_USER_DATA_DIR');
  const workerIndex = readEnv('TEST_WORKER_INDEX');

  if (!explicitUserDataDir && !workerIndex) {
    cachedContext = null;
    return cachedContext;
  }

  const resolvedWorkerIndex = workerIndex ?? '0';
  const runId = sanitizeEnvFragment(
    readEnv('PLAYWRIGHT_RUN_ID') ?? readEnv('GITHUB_RUN_ID') ?? `local-${process.ppid || process.pid}`,
  );
  const namespace = sanitizeEnvFragment(
    readEnv('PLAYWRIGHT_NAMESPACE') ?? `pw-${runId}-w${resolvedWorkerIndex}`,
  );
  const userDataDir = explicitUserDataDir ?? path.join(DEFAULT_ISOLATION_ROOT, namespace, 'user-data');
  const sessionPartition = readEnv('PLAYWRIGHT_SESSION_PARTITION') ?? `persist:${namespace}`;
  const remoteDebuggingPortOffset = Number.parseInt(resolvedWorkerIndex, 10);
  const remoteDebuggingPort =
    readEnv('ELECTRON_REMOTE_DEBUGGING_PORT') ??
    String(
      DEFAULT_REMOTE_DEBUGGING_PORT + (Number.isNaN(remoteDebuggingPortOffset) ? 0 : remoteDebuggingPortOffset),
    );

  cachedContext = {
    namespace,
    remoteDebuggingPort,
    runId,
    sessionPartition,
    userDataDir,
    workerIndex: resolvedWorkerIndex,
  };

  return cachedContext;
}

export function applyPlaywrightIsolationEnv(): PlaywrightIsolationContext | null {
  const context = getPlaywrightIsolationContext();

  if (!context) {
    return null;
  }

  process.env.PLAYWRIGHT_RUN_ID ??= context.runId;
  process.env.PLAYWRIGHT_WORKER_ID ??= context.workerIndex;
  process.env.PLAYWRIGHT_NAMESPACE ??= context.namespace;
  process.env.PLAYWRIGHT_USER_DATA_DIR ??= context.userDataDir;
  process.env.PLAYWRIGHT_SESSION_PARTITION ??= context.sessionPartition;
  process.env.PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK ??= 'true';
  process.env.ELECTRON_REMOTE_DEBUGGING_PORT ??= context.remoteDebuggingPort;

  return context;
}

export function clearPlaywrightIsolationEnv() {
  delete process.env.PLAYWRIGHT_RUN_ID;
  delete process.env.PLAYWRIGHT_WORKER_ID;
  delete process.env.PLAYWRIGHT_NAMESPACE;
  delete process.env.PLAYWRIGHT_USER_DATA_DIR;
  delete process.env.PLAYWRIGHT_SESSION_PARTITION;
  delete process.env.PLAYWRIGHT_DISABLE_SINGLE_INSTANCE_LOCK;
  delete process.env.ELECTRON_REMOTE_DEBUGGING_PORT;
  delete process.env.TEST_WORKER_INDEX;
  cachedContext = undefined;
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function sanitizeEnvFragment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '-');
}
