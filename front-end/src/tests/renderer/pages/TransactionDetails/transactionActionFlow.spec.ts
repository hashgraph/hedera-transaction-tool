// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import {
  executeTransactionActionFlow,
  shouldRefreshAfterActionAttempt,
} from '@renderer/pages/TransactionDetails/components/transactionActionFlow';

describe('transactionActionFlow', () => {
  test('cancel action refreshes after a failed attempt', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      action: 'cancel',
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('non-cancel action does not refresh on failure', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('archive failed'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      action: 'archive',
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  test('cancel action refreshes after successful execution', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      action: 'cancel',
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('cancel action surfaces refresh failures through callback', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const refresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onRefreshError = vi.fn();

    await executeTransactionActionFlow({
      action: 'cancel',
      execute,
      refresh,
      onSuccess,
      onError,
      onRefreshError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onRefreshError).toHaveBeenCalledTimes(1);
  });

  test('non-cancel action refreshes on success', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      action: 'archive',
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('shouldRefreshAfterActionAttempt only applies to cancel', () => {
    expect(shouldRefreshAfterActionAttempt('cancel')).toBe(true);
    expect(shouldRefreshAfterActionAttempt('execute')).toBe(false);
    expect(shouldRefreshAfterActionAttempt('archive')).toBe(false);
    expect(shouldRefreshAfterActionAttempt('remindSigners')).toBe(false);
  });
});
