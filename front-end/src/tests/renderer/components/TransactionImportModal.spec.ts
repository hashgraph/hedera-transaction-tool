// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import TransactionImportModal from '@renderer/components/TransactionImportModal.vue';
import type { V1ImportFilterResult } from '@shared/interfaces';

const SDK_ID = '0.0.2@1700000000.000000000';

const mocks = vi.hoisted(() => ({
  fetchBySdkId: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: {
    inject: () => ({
      backendTransaction: { fetchBySdkId: mocks.fetchBySdkId, lookup: mocks.lookup },
    }),
  },
}));

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: vi.fn(() => ({ selectedOrganization: { serverUrl: 'https://org.example.com' } })),
}));

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: { inject: vi.fn(() => ({ error: vi.fn(), success: vi.fn() })) },
}));

vi.mock('@renderer/utils', () => ({
  assertIsLoggedInOrganization: vi.fn(),
}));

vi.mock('@renderer/utils/logger', () => ({
  createLogger: vi.fn(() => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() })),
}));

vi.mock('@renderer/services/organization', () => ({
  importSignatures: vi.fn(),
}));

vi.mock('@renderer/utils/signatureTools.ts', () => ({
  makeSignatureMap: vi.fn(),
}));

const candidate = (transactionId: string, filePath = `/tmp/${transactionId}.zip`) => ({
  filePath,
  transactionId,
  transactionBytes: '',
  nodeSignatures: {},
});

const mountModal = (filterResult: V1ImportFilterResult) =>
  mount(TransactionImportModal, {
    props: { filterResult, show: true },
    global: {
      stubs: {
        AppModal: { template: '<div><slot /></div>' },
        AppCheckBox: true,
        AppButton: true,
        TransactionImportRow: true,
      },
    },
  });

describe('TransactionImportModal.vue', () => {
  beforeEach(() => {
    mocks.fetchBySdkId.mockReset();
    mocks.lookup.mockReset();
  });

  test('resolves candidates through fetchBySdkId (the file only carries the SDK transaction id)', async () => {
    mocks.fetchBySdkId.mockResolvedValue({ id: 42, transactionId: SDK_ID });

    mountModal({ candidates: [candidate(SDK_ID)], ignoredPaths: [] });
    await flushPromises();

    expect(mocks.fetchBySdkId).toHaveBeenCalledWith(SDK_ID, 'https://org.example.com');
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  test('fetches each distinct transaction id once', async () => {
    mocks.fetchBySdkId.mockResolvedValue({ id: 42, transactionId: SDK_ID });

    mountModal({
      candidates: [candidate(SDK_ID, '/tmp/a.zip'), candidate(SDK_ID, '/tmp/b.zip')],
      ignoredPaths: [],
    });
    await flushPromises();

    expect(mocks.fetchBySdkId).toHaveBeenCalledTimes(1);
  });

  test('tolerates a transaction unknown to the backend', async () => {
    mocks.fetchBySdkId.mockRejectedValue(new Error('404'));

    const wrapper = mountModal({ candidates: [candidate(SDK_ID)], ignoredPaths: [] });
    await flushPromises();

    expect(mocks.fetchBySdkId).toHaveBeenCalledTimes(1);
    expect(wrapper.exists()).toBe(true);
  });
});
