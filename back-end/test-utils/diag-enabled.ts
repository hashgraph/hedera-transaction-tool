/**
 * Single source of truth for whether diagnostic logging from issue #2576
 * (the `[jest-diag]`, `[pg-test-db]`, and `[cache.queries.spec]` streams)
 * should fire.
 *
 * Defaults to off so local-dev runs of `createTestPostgresDataSource` and
 * the integration specs that use it stay quiet. CI runners (GitHub Actions
 * sets `CI=true`) keep the full instrumentation. Set `JEST_DIAG=1` to opt
 * in locally; `JEST_DIAG=0` explicitly disables (matches the `INCLUDE_LIBS`
 * convention in `apps/notifications/jest.config.ts`).
 */
export const enableDiag: boolean =
  process.env.CI === 'true' ||
  (process.env.JEST_DIAG !== undefined && process.env.JEST_DIAG !== '0');
