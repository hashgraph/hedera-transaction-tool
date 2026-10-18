// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { PrivateKey } from '@hiero-ledger/sdk';

import ComplexKeySelectAccountModal from '@renderer/components/ComplexKey/ComplexKeySelectAccountModal.vue';

const accountId = ref('');
const key = ref<unknown>(null);
const isValid = ref(false);

vi.mock('@renderer/composables/useAccountId', () => ({
  default: () => ({
    accountId,
    key,
    isValid,
    accountIdFormatted: ref(''),
  }),
}));

vi.mock('@renderer/stores/storeUser', () => ({
  default: () => ({
    personal: { isLoggedIn: true, id: 'u1' },
    publicKeyToAccounts: [{ accounts: [{ account: '0.0.900' }, { account: '0.0.901' }] }],
  }),
}));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({ network: 'testnet' }) }));
vi.mock('@renderer/services/accountsService', () => ({
  getAll: vi.fn(async () => [{ account_id: '0.0.800', nickname: 'Treasury' }]),
}));

const stubs = {
  AppModal: { template: '<div><slot /></div>' },
  AppButton: {
    props: ['disabled', 'type'],
    template: '<button :disabled="disabled" :type="type"><slot /></button>',
  },
  AppInput: { template: '<input />' },
  AppListItem: { template: '<div class="account-item"><slot /></div>' },
};

async function mountModal(onSelectAccount = vi.fn()) {
  const errorHandler = vi.fn();
  const wrapper = mount(ComplexKeySelectAccountModal, {
    props: { show: true, onSelectAccount },
    global: { stubs, config: { errorHandler } },
  });
  await flushPromises();
  return { wrapper, onSelectAccount, errorHandler };
}

describe('ComplexKeySelectAccountModal.vue', () => {
  beforeEach(() => {
    accountId.value = '';
    key.value = null;
    isValid.value = false;
  });

  it('lists saved accounts followed by key-pair accounts, without duplicates', async () => {
    const { wrapper } = await mountModal();
    const text = wrapper.findAll('.account-item').map(i => i.text());
    expect(text).toEqual(['0.0.800 (Treasury)', '0.0.900', '0.0.901']);
  });

  it('Insert is disabled until the account id resolves to a valid account', async () => {
    const { wrapper } = await mountModal();
    const insert = () => wrapper.find('[data-testid="button-insert-account-id"]');
    expect(insert().attributes('disabled')).toBeDefined();
    isValid.value = true;
    await flushPromises();
    expect(insert().attributes('disabled')).toBeUndefined();
  });

  it("submitting hands the account's key to onSelectAccount", async () => {
    const pk = PrivateKey.generateED25519().publicKey;
    accountId.value = '0.0.800';
    key.value = pk;
    isValid.value = true;
    const { wrapper, onSelectAccount } = await mountModal();

    await wrapper.find('form').trigger('submit');
    expect(onSelectAccount).toHaveBeenCalledWith(pk);
  });

  it('does not call onSelectAccount when the account id is invalid', async () => {
    accountId.value = 'nope';
    key.value = PrivateKey.generateED25519().publicKey;
    const { wrapper, onSelectAccount, errorHandler } = await mountModal();

    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(onSelectAccount).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid Account ID' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not call onSelectAccount when the account has no key', async () => {
    accountId.value = '0.0.800';
    key.value = null;
    const { wrapper, onSelectAccount, errorHandler } = await mountModal();

    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(onSelectAccount).not.toHaveBeenCalled();
    expect(errorHandler).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Invalid key' }),
      expect.anything(),
      expect.anything(),
    );
  });
});
