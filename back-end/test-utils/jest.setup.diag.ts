/**
 * Diagnostic setup for the Notifications Jest config (issue #2576).
 *
 * Registered via `setupFiles`; runs once per test file, in every worker.
 * Emits tagged `[jest-diag]` lines to stderr for:
 *   - test-file lifecycle (`spec:start`)
 *   - process-level errors (`unhandledRejection`, `uncaughtException`, `warning`)
 *   - ioredis activity (`ioredis:require`, `ioredis:Redis.connect`,
 *     `ioredis:Redis.sendCommand:first`) — dragnets every real Redis client
 *     so a future leak identifies its own caller.
 *
 * All installs are idempotent per target (listeners keyed by Symbol, patches
 * by a flag on the function itself), so re-evaluation per test file is a no-op.
 * Connect logs are capped at CONNECT_LOG_LIMIT per worker; the suppressed
 * count is reported on `process:exit`.
 */

import type Module from 'module';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const NodeModule: typeof Module = require('module');

const DIAG_TAG = '[jest-diag]';

type Json = Record<string, unknown>;

function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'string' && v.length > 4000) return `${v.slice(0, 4000)}…<truncated>`;
      return v;
    });
  } catch {
    return String(obj);
  }
}

function diag(kind: string, extra: Json = {}): void {
  const payload: Json = {
    tag: DIAG_TAG,
    kind,
    ts: new Date().toISOString(),
    pid: process.pid,
    workerId: process.env.JEST_WORKER_ID ?? null,
    ...extra,
  };
  // stderr bypasses Jest's per-test console wrap, so listeners that fire
  // after a test ended don't spam "Cannot log after tests are done".
  try {
    process.stderr.write(`${DIAG_TAG} ${kind} ${safeStringify(payload)}\n`);
  } catch {
    // best-effort only
  }
}

function getTestContext(): { testPath: string | null; currentTestName: string | null } {
  try {
    const state = (globalThis as unknown as { expect?: { getState?: () => Json } })
      .expect?.getState?.();
    return {
      testPath: (state?.testPath as string) ?? null,
      currentTestName: (state?.currentTestName as string) ?? null,
    };
  } catch {
    return { testPath: null, currentTestName: null };
  }
}

// ---- Shared state ----------------------------------------------------------
//
// Symbol.for() returns the same symbol in every VM context in the worker,
// so even when Jest isolates the module registry per test file, we share
// this one slot on the (real) process object.

interface DiagState {
  loadedSpecs: Array<{ at: string; testPath: string | null }>;
  ioredisRequireCount: number;
  connectLoggedCount: number;
  connectSuppressedCount: number;
}
const STATE_KEY = Symbol.for('jestDiag.state');
const proc = process as unknown as Record<symbol, DiagState | undefined>;
if (!proc[STATE_KEY]) {
  proc[STATE_KEY] = {
    loadedSpecs: [],
    ioredisRequireCount: 0,
    connectLoggedCount: 0,
    connectSuppressedCount: 0,
  };
}
const state = proc[STATE_KEY]!;

// First N connect calls per worker get a full log; the rest are counted
// silently and reported on `process:exit`.
const CONNECT_LOG_LIMIT = 5;

// Tag listeners/patches so re-runs of this file are no-ops on the target.
const LISTENER_TAG = Symbol.for('jestDiag.listener');
type Tagged<T> = T & { [LISTENER_TAG]?: true };

function addListenerOnce(event: string, fn: (...args: unknown[]) => void): void {
  const already = process.listeners(event as NodeJS.Signals).some(
    (l) => (l as Tagged<typeof l>)[LISTENER_TAG] === true,
  );
  if (already) return;
  const tagged = fn as Tagged<typeof fn>;
  tagged[LISTENER_TAG] = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process as any).on(event, tagged);
}

// ---- Per-file log: which test file is this setupFile invocation for? -------

{
  const ctx = getTestContext();
  state.loadedSpecs.push({ at: new Date().toISOString(), testPath: ctx.testPath });
  diag('spec:start', ctx);
}

// ---- Process-level error listeners (attached at most once per worker) -----

addListenerOnce('unhandledRejection', (...args) => {
  const reason = args[0];
  diag('process:unhandledRejection', {
    ...getTestContext(),
    name: (reason as Error)?.name,
    message: (reason as Error)?.message ?? String(reason),
    stack: (reason as Error)?.stack,
    recentSpecs: state.loadedSpecs.slice(-15),
  });
});

addListenerOnce('uncaughtException', (...args) => {
  const err = args[0] as Error;
  diag('process:uncaughtException', {
    ...getTestContext(),
    name: err?.name,
    message: err?.message,
    stack: err?.stack,
    recentSpecs: state.loadedSpecs.slice(-15),
  });
});

addListenerOnce('warning', (...args) => {
  const warning = args[0] as Error;
  diag('process:warning', {
    ...getTestContext(),
    name: warning?.name,
    message: warning?.message,
    stack: warning?.stack,
  });
});

addListenerOnce('exit', (...args) => {
  const code = args[0];
  try {
    const p = process as unknown as {
      _getActiveHandles?: () => unknown[];
      _getActiveRequests?: () => unknown[];
    };
    const handles = (p._getActiveHandles?.() ?? []) as Array<Record<string, unknown>>;
    const requests = (p._getActiveRequests?.() ?? []) as Array<Record<string, unknown>>;
    diag('process:exit', {
      code,
      handleCount: handles.length,
      requestCount: requests.length,
      handles: handles.map((h) => ({
        type: (h as { constructor?: { name?: string } })?.constructor?.name,
        remoteAddress: (h as { remoteAddress?: string }).remoteAddress,
        remotePort: (h as { remotePort?: number }).remotePort,
      })),
      requests: requests.map((r) => ({
        type: (r as { constructor?: { name?: string } })?.constructor?.name,
      })),
      totalSpecsLoaded: state.loadedSpecs.length,
      totalIoredisRequires: state.ioredisRequireCount,
      ioredisConnectLogged: state.connectLoggedCount,
      ioredisConnectSuppressed: state.connectSuppressedCount,
    });
  } catch (e) {
    diag('process:exit:error', { message: (e as Error)?.message });
  }
});

// ---- Intercept every `require('ioredis')` ---------------------------------

try {
  const proto = (NodeModule as unknown as { prototype: { require: (id: string) => unknown } })
    .prototype;
  const originalRequire = proto.require;
  if (!(originalRequire as unknown as { __jestDiagWrapped?: boolean }).__jestDiagWrapped) {
    function patchedRequire(this: unknown, id: string): unknown {
      if (id === 'ioredis') {
        state.ioredisRequireCount += 1;
        diag('ioredis:require', {
          ...getTestContext(),
          count: state.ioredisRequireCount,
          stack: new Error('ioredis require').stack,
        });
      }
      return originalRequire.call(this, id);
    }
    (patchedRequire as unknown as { __jestDiagWrapped: boolean }).__jestDiagWrapped = true;
    proto.require = patchedRequire as typeof proto.require;
  }
} catch (err) {
  diag('require-patch:failed', { message: (err as Error)?.message });
}

// ---- Patch ioredis prototype methods ---------------------------------------
// All Redis instances share `Redis.prototype`, so patching methods there
// catches every client regardless of import path. We do NOT attempt to
// replace `ioredis.Redis` / `ioredis.default` because the compiled module
// ships them as getter-only properties.

let hadConnect = false;
let hadSendCommand = false;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ioredis = require('ioredis');
  const OriginalRedis = ioredis.Redis ?? ioredis.default ?? ioredis;

  if (OriginalRedis && OriginalRedis.prototype) {
    try {
      const origConnect = OriginalRedis.prototype.connect;
      if (
        typeof origConnect === 'function' &&
        !(origConnect as { __jestDiagPatched?: boolean }).__jestDiagPatched
      ) {
        hadConnect = true;
        function patchedConnect(this: unknown, ...args: unknown[]): unknown {
          if (state.connectLoggedCount < CONNECT_LOG_LIMIT) {
            state.connectLoggedCount += 1;
            diag('ioredis:Redis.connect', {
              ...getTestContext(),
              stack: new Error('ioredis Redis.connect').stack,
              logged: state.connectLoggedCount,
              limit: CONNECT_LOG_LIMIT,
            });
          } else {
            state.connectSuppressedCount += 1;
          }
          return origConnect.apply(this, args);
        }
        (patchedConnect as unknown as { __jestDiagPatched: boolean }).__jestDiagPatched = true;
        OriginalRedis.prototype.connect = patchedConnect;
      }
    } catch (err) {
      diag('ioredis:patch-connect-failed', { message: (err as Error)?.message });
    }

    try {
      const origSend = OriginalRedis.prototype.sendCommand;
      if (
        typeof origSend === 'function' &&
        !(origSend as { __jestDiagPatched?: boolean }).__jestDiagPatched
      ) {
        hadSendCommand = true;
        let firstLogged = false;
        function patchedSend(this: unknown, ...args: unknown[]): unknown {
          if (!firstLogged) {
            firstLogged = true;
            const cmd = args[0] as { name?: string; args?: unknown[] } | undefined;
            diag('ioredis:Redis.sendCommand:first', {
              ...getTestContext(),
              commandName: cmd?.name,
              stack: new Error('ioredis sendCommand').stack,
            });
          }
          return origSend.apply(this, args);
        }
        (patchedSend as unknown as { __jestDiagPatched: boolean }).__jestDiagPatched = true;
        OriginalRedis.prototype.sendCommand = patchedSend;
      }
    } catch (err) {
      diag('ioredis:patch-sendCommand-failed', { message: (err as Error)?.message });
    }
  }

  if (hadConnect || hadSendCommand) {
    diag('ioredis:patched', {
      hasPrototype: !!OriginalRedis?.prototype,
      connectPatched: hadConnect,
      sendCommandPatched: hadSendCommand,
    });
  }
} catch (err) {
  diag('ioredis:patch-failed', {
    message: (err as Error)?.message,
    stack: (err as Error)?.stack,
  });
}
