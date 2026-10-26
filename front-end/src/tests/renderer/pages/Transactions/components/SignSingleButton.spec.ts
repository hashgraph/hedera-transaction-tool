// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { h } from 'vue';

interface SingleControllerProps {
  transaction: unknown;
  callback?: (signed: boolean) => void;
  emitActivate?: (activate: boolean) => void;
  emitShow?: (show: boolean) => void;
}

const mocks = vi.hoisted(() => {
  const controllerProps: SingleControllerProps = { transaction: null };
  return {
    getStatus: vi.fn(),
    lookup: vi.fn(),
    controllerProps,
  };
});

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

function render(extraProps: { refreshTransaction?: boolean } = {}) {
  return mount(SignSingleButton, {
    props: { transactionId: 7, ...extraProps },
    global: {
      stubs: {
        AppButton: { template: '<button @click="$emit(\'click\', $event)"><slot /></button>' },
        SignTransactionController: {
          props: ['activate', 'transaction', 'callback'],
          emits: ['update:activate'],
          setup(props: any, { emit }: any) {
            mocks.controllerProps.emitActivate = (v: boolean) => emit('update:activate', v);
            return () => {
              mocks.controllerProps.transaction = props.transaction;
              mocks.controllerProps.callback = props.callback;
              return h('div', {
                'data-testid': 'controller',
                'data-active': String(props.activate),
              });
            };
          },
        },
        CreatorSignatureConfirmModal: {
          props: ['show', 'status', 'callback'],
          emits: ['update:show'],
          setup(_: unknown, { emit }: any) {
            mocks.controllerProps.emitShow = (v: boolean) => emit('update:show', v);
            return {};
          },
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
    mocks.controllerProps.transaction = null;
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

  test('hands the controller a snapshot, not the cached transaction object', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const cached = { id: 7, transactionBytes: 'aa' };
    mocks.lookup.mockResolvedValue(cached);
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();

    const passed = mocks.controllerProps.transaction as typeof cached;
    expect(passed).toEqual(cached);
    expect(passed).not.toBe(cached);

    // A later in-place update of the cache entry must not alter what will be signed
    cached.transactionBytes = 'bb';
    expect(passed.transactionBytes).toBe('aa');
  });

  test('emits the signed transaction after a successful sign without refresh', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await mocks.controllerProps.callback!(true);

    expect(wrapper.emitted('transactionSigned')).toHaveLength(1);
  });

  test('does not emit when signing did not complete', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    await mocks.controllerProps.callback!(false);

    expect(wrapper.emitted('transactionSigned')).toBeUndefined();
  });

  test('emits a freshly looked-up transaction when refreshTransaction is set', async () => {
    mocks.getStatus.mockReturnValue('verified');
    const refreshed = { id: 7, transactionBytes: 'refreshed' };
    const wrapper = render({ refreshTransaction: true });

    await wrapper.get('button').trigger('click');
    await flushPromises();
    mocks.lookup.mockResolvedValue(refreshed);
    await mocks.controllerProps.callback!(true);

    expect(wrapper.emitted('transactionSigned')).toEqual([[{ transaction: refreshed }]]);
  });

  test('closes the confirmation and resets signing from child v-model updates', async () => {
    mocks.getStatus.mockReturnValue('unverifiable');
    const wrapper = render();

    await wrapper.get('button').trigger('click');
    await flushPromises();
    mocks.controllerProps.emitShow!(false);
    await flushPromises();
    expect(wrapper.get('[data-testid="confirm"]').attributes('data-show')).toBe('false');

    mocks.controllerProps.emitActivate!(true);
    await flushPromises();
    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('true');
    mocks.controllerProps.emitActivate!(false);
    await flushPromises();
    expect(wrapper.get('[data-testid="controller"]').attributes('data-active')).toBe('false');
  });
});
