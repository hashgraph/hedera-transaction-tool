/**
 * Diagnostic setup for issue #2576.
 *
 * Registered via `setupFiles` on the Notifications Jest config so that every
 * worker process gets these listeners, regardless of which specs it happens
 * to run. The previous iteration installed listeners from inside
 * cache.queries.spec.ts, which meant only the worker that loaded that file
 * got them — and the ioredis-level error can fire in the *other* worker.
 *
 * This file exists purely to capture enough context to identify the spec
 * that creates an unmocked ioredis client. No behavior changes.
 */

const DIAG_TAG = '[jest-diag]';

function diag(kind: string, extra: Record<string, unknown> = {}) {
  const payload = {
    ts: new Date().toISOString(),
    pid: process.pid,
    workerId: process.env.JEST_WORKER_ID ?? null,
    ...extra,
  };
  // eslint-disable-next-line no-console
  console.log(`${DIAG_TAG} ${kind}`, payload);
}

function getTestContext(): { testPath: string | null; currentTestName: string | null } {
  try {
    const state = (globalThis as unknown as { expect?: { getState?: () => Record<string, unknown> } })
      .expect?.getState?.();
    return {
      testPath: (state?.testPath as string) ?? null,
      currentTestName: (state?.currentTestName as string) ?? null,
    };
  } catch {
    return { testPath: null, currentTestName: null };
  }
}

const g = globalThis as unknown as { __jestDiagInstalled?: boolean };
if (!g.__jestDiagInstalled) {
  g.__jestDiagInstalled = true;

  diag('worker:setupFiles:loaded', {
    nodeVersion: process.version,
  });

  process.on('unhandledRejection', (reason: unknown) => {
    diag('process:unhandledRejection', {
      ...getTestContext(),
      name: (reason as Error)?.name,
      message: (reason as Error)?.message ?? String(reason),
      stack: (reason as Error)?.stack,
    });
  });

  process.on('uncaughtException', (err: Error) => {
    diag('process:uncaughtException', {
      ...getTestContext(),
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
  });

  process.on('warning', (warning) => {
    diag('process:warning', {
      ...getTestContext(),
      name: warning.name,
      message: warning.message,
      stack: warning.stack,
    });
  });

  // Last-chance snapshot: if the worker dies with an error, what was still
  // holding it open? Open TCP sockets to :6379 are the smoking gun for a
  // leaked ioredis client.
  process.on('exit', (code) => {
    try {
      // Internal Node APIs, intentional for diagnostics only.
      const proc = process as unknown as {
        _getActiveHandles?: () => unknown[];
        _getActiveRequests?: () => unknown[];
      };
      const handles = (proc._getActiveHandles?.() ?? []) as Array<Record<string, unknown>>;
      const requests = (proc._getActiveRequests?.() ?? []) as Array<Record<string, unknown>>;
      const handleSummary = handles.map((h) => ({
        type: (h as { constructor?: { name?: string } })?.constructor?.name,
        remoteAddress: (h as { remoteAddress?: string }).remoteAddress,
        remotePort: (h as { remotePort?: number }).remotePort,
        readable: (h as { readable?: boolean }).readable,
        writable: (h as { writable?: boolean }).writable,
      }));
      const requestSummary = requests.map((r) => ({
        type: (r as { constructor?: { name?: string } })?.constructor?.name,
      }));
      diag('process:exit', {
        code,
        handleCount: handles.length,
        requestCount: requests.length,
        handles: handleSummary,
        requests: requestSummary,
      });
    } catch (e) {
      diag('process:exit:error', { message: (e as Error)?.message });
    }
  });

  // Monkey-patch the ioredis Redis constructor so every unmocked instantiation
  // logs the stack of its caller. Specs that use `jest.mock('ioredis', ...)`
  // will substitute their own mock and bypass this — which is exactly what we
  // want: only unmocked, real clients show up here.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ioredis = require('ioredis');
    const OriginalRedis = ioredis.Redis ?? ioredis.default ?? ioredis;
    const alreadyWrapped = (OriginalRedis as { __jestDiagWrapped?: boolean })?.__jestDiagWrapped;

    if (OriginalRedis && !alreadyWrapped) {
      class WrappedRedis extends OriginalRedis {
        constructor(...args: unknown[]) {
          const stack = new Error('ioredis Redis constructed').stack;
          diag('ioredis:new-Redis', {
            ...getTestContext(),
            argCount: args.length,
            firstArgType: typeof args[0],
            firstArgPreview:
              typeof args[0] === 'string'
                ? (args[0] as string).slice(0, 120)
                : undefined,
            stack,
          });
          super(...(args as []));
        }
      }
      (WrappedRedis as unknown as { __jestDiagWrapped: boolean }).__jestDiagWrapped = true;

      if (ioredis.Redis === OriginalRedis) {
        ioredis.Redis = WrappedRedis;
      }
      if (ioredis.default === OriginalRedis) {
        ioredis.default = WrappedRedis;
      }
      // CommonJS default: `require('ioredis')` sometimes returns the class itself.
      if (
        typeof ioredis === 'function' &&
        Object.prototype.hasOwnProperty.call(require.cache, require.resolve('ioredis'))
      ) {
        const modEntry = require.cache[require.resolve('ioredis')];
        if (modEntry && modEntry.exports === OriginalRedis) {
          modEntry.exports = WrappedRedis;
        }
      }

      diag('ioredis:patched', {});
    } else if (alreadyWrapped) {
      diag('ioredis:patch-skipped', { reason: 'already-wrapped' });
    } else {
      diag('ioredis:patch-skipped', { reason: 'no-original-export' });
    }
  } catch (err) {
    diag('ioredis:patch-failed', {
      message: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });
  }
}
