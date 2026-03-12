// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import {
  executeTransactionActionFlow,
} from '@renderer/pages/TransactionDetails/components/transactionActionFlow';

describe('transactionActionFlow', () => {
  test('cancel action refreshes after a failed attempt', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('non-cancel action refreshes after a failed attempt', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('archive failed'));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('cancel action refreshes after successful execution', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('surfaces refresh failures through callback on error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('cancel failed'));
    const refresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onRefreshError = vi.fn();

    await executeTransactionActionFlow({
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
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('does not refresh twice on success', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await executeTransactionActionFlow({
      execute,
      refresh,
      onSuccess,
      onError,
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test('does not call onSuccess when refresh fails on success path', async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const refresh = vi.fn().mockRejectedValue(new Error('refresh failed'));
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const onRefreshError = vi.fn();

    await executeTransactionActionFlow({
      execute,
      refresh,
      onSuccess,
      onError,
      onRefreshError,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onRefreshError).toHaveBeenCalledWith(expect.any(Error));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
