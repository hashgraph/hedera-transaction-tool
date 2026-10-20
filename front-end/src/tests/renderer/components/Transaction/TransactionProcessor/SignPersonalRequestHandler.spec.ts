// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getPasswordAsync: vi.fn(),
}));

vi.mock('@renderer/composables/usePersonalPassword', () => ({
  default: vi.fn(() => ({ getPasswordAsync: mocks.getPasswordAsync })),
}));

vi.mock('@renderer/services/keyPairService', () => ({
  flattenKeyList: vi.fn(() => [{ toStringRaw: () => 'pubkey-1' }]),
}));

vi.mock('@renderer/services/transactionService', () => ({
  signTransaction: vi.fn(),
}));

vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    assertUserLoggedIn: vi.fn(),
  };
});

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    Transaction: {
      fromBytes: vi.fn(() => ({})),
    },
  };
});

vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({
    personal: { id: 'user-1' },
    publicKeys: ['pubkey-1'],
  })),
}));

import SignPersonalRequestHandler from '@renderer/components/Transaction/TransactionProcessor/components/SignPersonalRequestHandler.vue';
import { TransactionRequest } from '@renderer/components/Transaction/TransactionProcessor';
import { signTransaction } from '@renderer/services/transactionService';

const signTransactionMock = vi.mocked(signTransaction);

type HandlerVm = {
  handle: (r: unknown) => Promise<void>;
  setNext: (h: { handle: (r: unknown) => Promise<void> }) => void;
};

function buildRequest() {
  return TransactionRequest.fromData({
    transactionKey: {} as never,
    transactionBytes: new Uint8Array([0]),
    name: 'test',
    description: '',
    submitManually: false,
    reminderMillisecondsBefore: null,
  });
}

function mountHandler() {
  return mount(SignPersonalRequestHandler);
}

describe('SignPersonalRequestHandler.vue', () => {
  beforeEach(() => {
    signTransactionMock.mockReset();
    // Simulates a password already cached from a prior prompt, so signing
    // proceeds without needing the modal by default.
    mocks.getPasswordAsync.mockReset().mockResolvedValue('password');
  });

  describe('password handling', () => {
    test('signs with the password returned by the prompt and forwards signed bytes to the next handler', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce('typed-password');
      const signedBytes = new Uint8Array([9, 9]);
      signTransactionMock.mockResolvedValueOnce(signedBytes);

      const wrapper = mountHandler();
      const nextHandle = vi.fn().mockResolvedValue(undefined);
      (wrapper.vm as unknown as HandlerVm).setNext({ handle: nextHandle });

      await (wrapper.vm as unknown as HandlerVm).handle(buildRequest());

      expect(signTransactionMock).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        ['pubkey-1'],
        'user-1',
        'typed-password',
      );
      expect(wrapper.emitted('transaction:sign:success')).toBeTruthy();
      expect(nextHandle).toHaveBeenCalledWith(
        expect.objectContaining({ transactionBytes: signedBytes }),
      );
    });

    // Regression test: this used to throw "Password is required to sign" unconditionally
    // instead of prompting the user for it.
    test('aborts quietly without signing or advancing the chain when the user cancels the password prompt', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce(false);

      const wrapper = mountHandler();
      const nextHandle = vi.fn();
      (wrapper.vm as unknown as HandlerVm).setNext({ handle: nextHandle });

      await (wrapper.vm as unknown as HandlerVm).handle(buildRequest());

      expect(signTransactionMock).not.toHaveBeenCalled();
      expect(nextHandle).not.toHaveBeenCalled();
      expect(wrapper.emitted('transaction:sign:begin')).toBeUndefined();
      expect(wrapper.emitted('transaction:sign:fail')).toBeUndefined();
    });

    test('emits sign:fail and rethrows when signing itself fails', async () => {
      mocks.getPasswordAsync.mockResolvedValueOnce('typed-password');
      const err = new Error('boom');
      signTransactionMock.mockRejectedValueOnce(err);

      const wrapper = mountHandler();

      await expect(
        (wrapper.vm as unknown as HandlerVm).handle(buildRequest()),
      ).rejects.toBe(err);

      expect(wrapper.emitted('transaction:sign:fail')).toBeTruthy();
    });
  });
});
