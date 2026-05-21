// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';

/**
 * Hoisted mock fns — referenced from inside vi.mock factories, which run
 * before module imports.
 */
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());

vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: () => ({ error: toastErrorMock, success: toastSuccessMock }),
  },
}));

/**
 * Replace each child handler module with a barebones stub. This avoids
 * pulling the real handlers' deps (stores, services, SDK) into the test,
 * and exposes the methods that TransactionProcessor calls via refs
 * (setShow, handle, setNext) so its ref-bound calls don't blow up.
 */
function stubHandler(name: string, emits: string[]) {
  return defineComponent({
    name,
    emits,
    methods: {
      handle() {},
      setNext() {},
      setShow() {},
    },
    template: '<div></div>',
  });
}

vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/CheckKeySettingHandler.vue',
  () => ({ default: stubHandler('CheckKeySettingHandler', []) }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/ValidateRequestHandler.vue',
  () => ({ default: stubHandler('ValidateRequestHandler', []) }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/ConfirmTransactionHandler.vue',
  () => ({ default: stubHandler('ConfirmTransactionHandler', []) }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/MultipleAccountUpdateRequestHandler.vue',
  () => ({
    default: stubHandler('MultipleAccountUpdateRequestHandler', [
      'transaction:sign:begin',
      'transaction:sign:success',
      'transaction:sign:fail',
      'transaction:executed',
      'transaction:stored',
      'transaction:group:submit:success',
      'transaction:group:submit:fail',
      'loading:begin',
      'loading:end',
    ]),
  }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/BigFileOrganizationRequestHandler.vue',
  () => ({
    default: stubHandler('BigFileOrganizationRequestHandler', [
      'transaction:group:submit:success',
      'transaction:group:submit:fail',
      'loading:begin',
      'loading:end',
    ]),
  }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/BigFilePersonalRequestHandler.vue',
  () => ({
    default: stubHandler('BigFilePersonalRequestHandler', [
      'transaction:sign:begin',
      'transaction:sign:success',
      'transaction:sign:fail',
      'transaction:executed',
      'transaction:stored',
    ]),
  }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/OrganizationRequestHandler.vue',
  () => ({
    default: stubHandler('OrganizationRequestHandler', [
      'transaction:submit:success',
      'transaction:submit:fail',
      'loading:begin',
      'loading:end',
    ]),
  }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/SignPersonalRequestHandler.vue',
  () => ({
    default: stubHandler('SignPersonalRequestHandler', [
      'transaction:sign:begin',
      'transaction:sign:success',
      'transaction:sign:fail',
    ]),
  }),
);
vi.mock(
  '@renderer/components/Transaction/TransactionProcessor/components/ExecutePersonalRequestHandler.vue',
  () => ({
    default: stubHandler('ExecutePersonalRequestHandler', [
      'transaction:executed',
      'transaction:stored',
    ]),
  }),
);

import TransactionProcessor from '@renderer/components/Transaction/TransactionProcessor/TransactionProcessor.vue';

function mountProcessor() {
  return mount(TransactionProcessor, {
    props: {
      hasDataChanged: false,
      saveDraft: async () => {},
    },
  });
}

describe('TransactionProcessor.vue', () => {
  beforeEach(() => {
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  describe('handleSubmitFail (issue: silent failure when retries are exhausted)', () => {
    test('toasts the error message when OrganizationRequestHandler emits transaction:submit:fail with an Error', async () => {
      const wrapper = mountProcessor();
      const err = new Error('A transaction with this transactionId already exists.');

      const org = wrapper.findComponent({ name: 'OrganizationRequestHandler' });
      expect(org.exists()).toBe(true);
      org.vm.$emit('transaction:submit:fail', err);

      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('A transaction with this transactionId already exists.');
    });

    test('falls back to a default message when the emitted value is not an Error', async () => {
      const wrapper = mountProcessor();

      const org = wrapper.findComponent({ name: 'OrganizationRequestHandler' });
      org.vm.$emit('transaction:submit:fail', 'just a string, not an Error');

      expect(toastErrorMock).toHaveBeenCalledWith('Failed to submit transaction');
    });

    test('also toasts when group-submission handlers emit transaction:group:submit:fail', async () => {
      const wrapper = mountProcessor();
      const err = new Error('group failed');

      // MultipleAccountUpdateRequestHandler shares handleSubmitFail.
      const mau = wrapper.findComponent({ name: 'MultipleAccountUpdateRequestHandler' });
      mau.vm.$emit('transaction:group:submit:fail', err);
      expect(toastErrorMock).toHaveBeenLastCalledWith('group failed');

      // BigFileOrganizationRequestHandler also shares it.
      const bigFile = wrapper.findComponent({ name: 'BigFileOrganizationRequestHandler' });
      bigFile.vm.$emit('transaction:group:submit:fail', new Error('big file failed'));
      expect(toastErrorMock).toHaveBeenLastCalledWith('big file failed');

      expect(toastErrorMock).toHaveBeenCalledTimes(2);
    });
  });
});
