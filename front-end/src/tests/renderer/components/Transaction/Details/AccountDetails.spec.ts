// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { AccountUpdateTransaction, ContractId, Key, PrivateKey } from '@hiero-ledger/sdk';
import AccountDetails from '@renderer/components/Transaction/Details/AccountDetails.vue';

const mocks = vi.hoisted(() => ({ formatPublicKey: vi.fn() }));
vi.mock('@renderer/stores/storeUser', () => ({ default: () => ({ personal: { id: '1' } }) }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => ({}) }));
vi.mock('@renderer/caches/AppCache.ts', () => ({ AppCache: { inject: () => ({}) } }));
vi.mock('@renderer/utils/ToastManager', () => ({ ToastManager: { inject: () => ({}) } }));
vi.mock('@renderer/services/accountsService', () => ({ add: vi.fn(), getAll: vi.fn() }));
vi.mock('@renderer/utils', () => ({
  isUserLoggedIn: () => true,
  isAccountId: () => true,
  stringifyHbar: String,
  safeAwait: vi.fn(),
  getAccountNicknameFromId: vi.fn(),
  getAccountIdWithChecksum: String,
  formatPublicKey: mocks.formatPublicKey,
  extractIdentifier: () => null,
}));
const render = (key?: Key) =>
  mount(AccountDetails, {
    props: {
      transaction: key
        ? new AccountUpdateTransaction().setKey(key)
        : new AccountUpdateTransaction(),
      organizationTransaction: null,
    },
    global: { stubs: { KeyStructureModal: true, AppButton: true } },
  });

describe('account key display', () => {
  it('shows the raw key and loading state while ownership is pending', async () => {
    let resolve!: (value: string) => void;
    mocks.formatPublicKey.mockReturnValue(
      new Promise<string>(r => {
        resolve = r;
      }),
    );
    const pk = PrivateKey.generateED25519().publicKey;
    const wrapper = render(pk);
    expect(wrapper.get('[role="status"]').text()).toContain('Loading');
    expect(wrapper.text()).toContain(pk.toStringRaw());
    expect(wrapper.text()).not.toContain('None');
    resolve('Owner');
    await flushPromises();
    expect(wrapper.text()).toContain('Owner');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });
  it('shows contract keys and warns for unknown keys', () => {
    expect(render(ContractId.fromString('0.0.456')).text()).toContain('Contract 0.0.456');
    const wrapper = render({} as Key);
    expect(wrapper.get('[role="alert"]').text()).toContain('Unsupported key type');
    expect(wrapper.text()).not.toContain('None');
  });
  it('omits the unchanged key row when the body key is absent', () => {
    expect(render().find('[data-testid="p-account-details-key"]').exists()).toBe(false);
  });
});
