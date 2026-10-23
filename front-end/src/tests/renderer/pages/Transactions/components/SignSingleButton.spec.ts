// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({
    selectedOrganization: { serverUrl: 'https://org.test', userKeys: [{ id: 1, publicKey: 'pk' }] },
  }),
}));
vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: { inject: () => ({ backendTransaction: { lookup: mocks.lookup } }) },
}));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  assertIsLoggedInOrganization: vi.fn(),
  getCreatorSignatureStatus: mocks.getStatus,
}));

import SignSingleButton from '@renderer/pages/Transactions/components/SignSingleButton.vue';

const tx = { id: 7, transactionBytes: 'aa' };

function render() {
  return mount(SignSingleButton, {
    props: { transactionId: 7 },
    global: {
      stubs: {
        AppButton: { template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
        SignTransactionController: {
          props: ['activate', 'transaction'],
          template: '<div data-testid="controller" :data-active="String(activate)" />',
        },
        CreatorSignatureConfirmModal: {
          props: ['show', 'status', 'callback'],
          template:
            '<div data-testid="confirm" :data-show="String(show)" :data-status="status" @click="callback()" />',
        },
      },
    },
  });
}

describe('SignSingleButton.vue', () => {
  beforeEach(() => {
    mocks.lookup.mockReset().mockResolvedValue(tx);
    mocks.getStatus.mockReset();
  });

  test('starts signing directly when the creator signature is verified', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('true');
    expect(wrapper.get('[data-testid="confirm"]').attributes('data-show')).toBe('false');
  });

  test.each(['unverifiable', 'data-missing', 'creator-unavailable'])(
    'asks for confirmation instead of signing when status is %s',
    async status => {
      mocks.getStatus.mockReturnValue(status);
      const wrapper = render();

      await wrapper.get('button').trigger('click');
      await flushPromises();

      expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('false');
      expect(wrapper.get('[data-testid="confirm"]').attributes('data-show')).toBe('true');
      expect(wrapper.get('[data-testid="confirm"]').attributes('data-status')).toBe(status);
    },
  );

  test('starts signing once the user confirms the warning', async () => {
    mocks.getStatus.mockReturnValue('unverifiable');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await wrapper.get('[data-testid="confirm"]').trigger('click');

    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('true');
  });

  test('checks the transaction that was looked up for signing', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(mocks.getStatus).toHaveBeenCalledWith(tx, [{ id: 1, publicKey: 'pk' }]);
  });
});
