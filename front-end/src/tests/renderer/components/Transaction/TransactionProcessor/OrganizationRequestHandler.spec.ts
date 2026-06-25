// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@renderer/services/keyPairService', () => ({
  decryptPrivateKey: vi.fn().mockResolvedValue('priv-key-raw'),
}));

vi.mock('@renderer/services/organization', () => ({
  submitTransaction: vi.fn(),
  addObservers: vi.fn().mockResolvedValue(undefined),
  addApprovers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@renderer/composables/useDraft', () => ({
  default: vi.fn(() => ({
    deleteIfNotTemplate: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({ error: vi.fn(), success: vi.fn() })),
  },
}));

vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return {
    ...actual,
    assertIsLoggedInOrganization: vi.fn(),
    assertUserLoggedIn: vi.fn(),
    getPrivateKey: vi.fn(() => ({ sign: () => new Uint8Array([0xab]) })),
    uint8ToHex: vi.fn(() => 'hex'),
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
    selectedOrganization: {
      serverUrl: 'https://org.test',
      userKeys: [{ publicKey: 'pubkey-1', id: 42 }],
    },
    personal: { id: 'user-1', useKeychain: false },
    getPassword: () => 'password',
  })),
}));

vi.mock('@renderer/stores/storeKeys', () => ({
  default: vi.fn(() => ({
    keyPairs: [{ public_key: 'pubkey-1' }],
  })),
}));

vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ network: 'testnet' })),
}));

import OrganizationRequestHandler from '@renderer/components/Transaction/TransactionProcessor/components/OrganizationRequestHandler.vue';
import { TransactionRequest } from '@renderer/components/Transaction/TransactionProcessor';
import { ErrorCodes, ErrorMessages } from '@shared/constants';
import { RequestError } from '@renderer/utils';
import { submitTransaction } from '@renderer/services/organization';

const submitTransactionMock = vi.mocked(submitTransaction);

function buildRequest(bytesFactory?: (n: number) => Uint8Array) {
  return TransactionRequest.fromData({
    transactionKey: {} as never,
    transactionBytes: new Uint8Array([0]),
    name: 'test',
    description: '',
    submitManually: false,
    reminderMillisecondsBefore: null,
    bytesFactory,
  });
}

function mountHandler() {
  return mount(OrganizationRequestHandler, {
    props: { observers: [], approvers: [] },
  });
}

const texError = () => new RequestError(ErrorMessages[ErrorCodes.TEX], ErrorCodes.TEX, 400);

describe('OrganizationRequestHandler.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    submitTransactionMock.mockReset();
  });

  describe('happy path', () => {
    test('submits once and emits success when the first attempt resolves', async () => {
      submitTransactionMock.mockResolvedValue({
        id: 1,
        transactionBytes: 'bytes-hex',
      } as never);

      const wrapper = mountHandler();
      const factory = vi.fn();
      await (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
        buildRequest(factory),
      );

      expect(submitTransactionMock).toHaveBeenCalledTimes(1);
      expect(factory).not.toHaveBeenCalled();
      expect(wrapper.emitted('transaction:submit:success')).toEqual([[1, 'bytes-hex']]);
      expect(wrapper.emitted('transaction:submit:fail')).toBeUndefined();
    });
  });

  describe('TEX retry behavior', () => {
    test('retries with a nano-offset and emits success when retry resolves', async () => {
      submitTransactionMock
        .mockRejectedValueOnce(texError())
        .mockResolvedValueOnce({ id: 7, transactionBytes: 'b' } as never);

      const factory = vi.fn((_: number) => new Uint8Array([1]));
      const wrapper = mountHandler();
      await (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
        buildRequest(factory),
      );

      expect(submitTransactionMock).toHaveBeenCalledTimes(2);
      expect(factory).toHaveBeenCalledTimes(1);

      const offset = factory.mock.calls[0][0] as number;
      // Attempt-1 bucket
      expect(offset).toBeGreaterThanOrEqual(1);
      expect(offset).toBeLessThanOrEqual(333_333);

      expect(wrapper.emitted('transaction:submit:success')).toBeTruthy();
      expect(wrapper.emitted('transaction:submit:fail')).toBeUndefined();
    });

    test('exhausts MAX_NANO_RETRIES then emits fail with the TEX error', async () => {
      const err = texError();
      submitTransactionMock.mockRejectedValue(err);

      const factory = vi.fn((_: number) => new Uint8Array([0]));
      const wrapper = mountHandler();

      await expect(
        (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
          buildRequest(factory),
        ),
      ).rejects.toBe(err);

      // 1 original attempt + 3 retries (MAX_NANO_RETRIES)
      expect(submitTransactionMock).toHaveBeenCalledTimes(4);
      expect(factory).toHaveBeenCalledTimes(3);

      const emitted = wrapper.emitted('transaction:submit:fail');
      expect(emitted).toBeTruthy();
      expect(emitted?.[0]?.[0]).toBe(err);
    });

    test('retry offsets land in disjoint buckets within the 1 ms ceiling', async () => {
      const err = texError();
      submitTransactionMock
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({ id: 1, transactionBytes: 'b' } as never);

      const factory = vi.fn((_: number) => new Uint8Array([0]));
      const wrapper = mountHandler();
      await (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
        buildRequest(factory),
      );

      expect(factory).toHaveBeenCalledTimes(3);
      const offsets = factory.mock.calls.map(c => c[0] as number);
      const [o1, o2, o3] = offsets;

      expect(o1).toBeGreaterThanOrEqual(1);
      expect(o1).toBeLessThanOrEqual(333_333);

      expect(o2).toBeGreaterThanOrEqual(333_334);
      expect(o2).toBeLessThanOrEqual(666_666);

      expect(o3).toBeGreaterThanOrEqual(666_667);
      expect(o3).toBeLessThanOrEqual(999_999);

      // No two attempts share an offset, and all stay strictly under 1 ms.
      expect(new Set(offsets).size).toBe(3);
      offsets.forEach(o => expect(o).toBeLessThan(1_000_000));
    });

    test('does NOT retry on TEX when no bytesFactory is supplied', async () => {
      const err = texError();
      submitTransactionMock.mockRejectedValue(err);

      const wrapper = mountHandler();
      await expect(
        (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
          buildRequest(undefined),
        ),
      ).rejects.toBe(err);

      expect(submitTransactionMock).toHaveBeenCalledTimes(1);
      expect(wrapper.emitted('transaction:submit:fail')).toBeTruthy();
    });
  });

  describe('non-TEX errors', () => {
    test('does not retry and emits fail immediately with the original error', async () => {
      const other = new Error('some other error');
      submitTransactionMock.mockRejectedValue(other);

      const factory = vi.fn();
      const wrapper = mountHandler();

      await expect(
        (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
          buildRequest(factory),
        ),
      ).rejects.toBe(other);

      expect(submitTransactionMock).toHaveBeenCalledTimes(1);
      expect(factory).not.toHaveBeenCalled();

      const emitted = wrapper.emitted('transaction:submit:fail');
      expect(emitted).toBeTruthy();
      expect(emitted?.[0]?.[0]).toBe(other);
    });
  });

  describe('emit lifecycle', () => {
    test('emits loading:begin before submit and loading:end after, including on failure', async () => {
      const err = texError();
      submitTransactionMock.mockRejectedValue(err);

      const wrapper = mountHandler();
      const factory = vi.fn((_: number) => new Uint8Array([0]));

      await expect(
        (wrapper.vm as unknown as { handle: (r: unknown) => Promise<void> }).handle(
          buildRequest(factory),
        ),
      ).rejects.toBe(err);

      expect(wrapper.emitted('loading:begin')).toBeTruthy();
      expect(wrapper.emitted('loading:end')).toBeTruthy();
    });
  });
});
