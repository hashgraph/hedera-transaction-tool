// @vitest-environment happy-dom
/**
 * Mounts the real form with the real useAccountId composable and only fakes the mirror node
 * lookups, so slow and out-of-order responses (which broke the Playwright "link existing account"
 * tests in CI) are exercised at the level the user sees: the Link Account button and the submit.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

import LinkExistingAccount from '@renderer/pages/Accounts/LinkExistingAccount/LinkExistingAccount.vue';

type Deferred = {
  promise: Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
};

const mocks = vi.hoisted(() => ({
  lookup: vi.fn(),
  getAccountAllowances: vi.fn(),
  add: vi.fn(),
  routerPush: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({ back: vi.fn(), push: mocks.routerPush })),
}));
vi.mock('@renderer/stores/storeUser', () => ({
  default: vi.fn(() => ({ personal: { id: 'local-user-id', isLoggedIn: true } })),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({
  default: vi.fn(() => ({ network: 'testnet', mirrorNodeBaseURL: 'http://mirror', client: {} })),
}));
vi.mock('@renderer/caches/AppCache', () => ({
  AppCache: { inject: () => ({ mirrorAccountById: { lookup: mocks.lookup } }) },
}));
vi.mock('@renderer/services/mirrorNodeDataService', () => ({
  getAccountAllowances: mocks.getAccountAllowances,
}));
vi.mock('@renderer/services/electronUtilsService', () => ({ openExternal: vi.fn() }));
vi.mock('@renderer/services/keyPairService', () => ({ flattenKeyList: vi.fn(() => []) }));
vi.mock('@renderer/services/accountsService', () => ({ add: mocks.add }));
vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));
vi.mock('@renderer/utils/ToastManager', () => ({
  ToastManager: {
    inject: vi.fn(() => ({ error: mocks.toastError, success: mocks.toastSuccess })),
  },
}));

const stubs = {
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button v-bind="$attrs" :disabled="disabled" :type="type"><slot /></button>',
  },
  AppInput: {
    props: ['modelValue'],
    template:
      '<input v-bind="$attrs" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @blur="$emit(\'blur\', $event)" />',
  },
};

const accountInfo = (id: string) => ({
  accountId: { toString: () => id },
  balance: { toString: () => '10 ℏ' },
});

function deferred(): Deferred {
  let resolve!: (v: unknown) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('LinkExistingAccount.vue with real account lookups', () => {
  // One pending lookup per request, in the order they were made
  let lookups: { id: string; request: Deferred }[];

  const mountForm = () => mount(LinkExistingAccount, { global: { stubs } });
  const type = async (wrapper: ReturnType<typeof mountForm>, value: string) => {
    await wrapper.find('[data-testid="input-existing-account-id"]').setValue(value);
    await flushPromises();
  };
  const button = (wrapper: ReturnType<typeof mountForm>) =>
    wrapper.find('[data-testid="button-link-account-id"]');
  const respond = async (index: number, value: unknown) => {
    lookups[index].request.resolve(value);
    await flushPromises();
  };

  beforeEach(() => {
    vi.resetAllMocks();
    lookups = [];
    mocks.lookup.mockImplementation((id: string) => {
      const request = deferred();
      lookups.push({ id, request });
      return request.promise;
    });
    mocks.getAccountAllowances.mockResolvedValue([]);
    mocks.add.mockResolvedValue([]);
  });

  test('keeps the button disabled while the lookup is still pending, then enables it', async () => {
    const wrapper = mountForm();
    await type(wrapper, '0.0.1180');

    expect(button(wrapper).attributes('disabled')).toBeDefined();

    await respond(0, accountInfo('0.0.1180'));

    expect(button(wrapper).attributes('disabled')).toBeUndefined();
  });

  test('stays enabled when the lookup for a shorter, typed-over id answers "not found" last', async () => {
    // What the Playwright helper did: fill the full id, delete the last digit, type it back
    const wrapper = mountForm();
    await type(wrapper, '0.0.1180');
    await type(wrapper, '0.0.118');
    await type(wrapper, '0.0.1180');

    expect(lookups.map(l => l.id)).toEqual(['0.0.1180', '0.0.118', '0.0.1180']);

    await respond(2, accountInfo('0.0.1180')); // the current id resolves first
    await respond(0, accountInfo('0.0.1180'));
    await respond(1, null); // the outdated id answers "not found" last

    expect(button(wrapper).attributes('disabled')).toBeUndefined();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(mocks.add).toHaveBeenCalledWith('local-user-id', '0.0.1180', 'testnet', '');
    expect(mocks.routerPush).toHaveBeenCalledWith({ name: 'accounts' });
  });

  test('does not link an outdated id whose lookup succeeds after the current one failed to match', async () => {
    const wrapper = mountForm();
    await type(wrapper, '0.0.118');
    await type(wrapper, '0.0.1180');

    await respond(1, null); // current id does not exist
    await respond(0, accountInfo('0.0.118')); // the outdated id exists, but is no longer typed

    expect(button(wrapper).attributes('disabled')).toBeDefined();
  });

  test('stays enabled when a lookup for an outdated id fails after the current one succeeded', async () => {
    const wrapper = mountForm();
    await type(wrapper, '0.0.118');
    await type(wrapper, '0.0.1180');

    await respond(1, accountInfo('0.0.1180'));
    lookups[0].request.reject(new Error('mirror node timeout'));
    await flushPromises();

    expect(button(wrapper).attributes('disabled')).toBeUndefined();
  });

  test('stays enabled when loading allowances fails for the current id', async () => {
    mocks.getAccountAllowances.mockRejectedValue(new Error('429 Too Many Requests'));
    const wrapper = mountForm();
    await type(wrapper, '0.0.1180');
    await respond(0, accountInfo('0.0.1180'));

    expect(button(wrapper).attributes('disabled')).toBeUndefined();
  });

  test('disables the button again when the field is cleared', async () => {
    const wrapper = mountForm();
    await type(wrapper, '0.0.1180');
    await respond(0, accountInfo('0.0.1180'));
    expect(button(wrapper).attributes('disabled')).toBeUndefined();

    await type(wrapper, '');

    expect(button(wrapper).attributes('disabled')).toBeDefined();
  });
});
