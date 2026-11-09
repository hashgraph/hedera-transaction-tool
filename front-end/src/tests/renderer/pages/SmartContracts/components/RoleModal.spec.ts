// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { AxiosError } from 'axios';
import { Client } from '@hashgraph/sdk';

import RoleModal from '@renderer/pages/SmartContracts/components/RoleModal.vue';
import { ToastManager } from '@renderer/utils/ToastManager';
import type { ContractRole } from '@renderer/utils/sdk/contractRoles';

const mocks = vi.hoisted(() => ({
  userStore: {
    personal: { isLoggedIn: true, id: 'local-user' } as any,
    publicKeysToAccountsFlattened: [] as string[],
  },
  networkStore: {
    network: 'testnet',
    mirrorNodeBaseURL: 'https://mirror.example',
    client: null as any,
  },
  getAllAccounts: vi.fn(),
  getAccountInfo: vi.fn(),
  getContractInfo: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: vi.fn(() => mocks.networkStore) }));
vi.mock('@renderer/services/accountsService', () => ({ getAll: mocks.getAllAccounts }));
vi.mock('@renderer/services/mirrorNodeDataService', () => ({
  getAccountInfo: mocks.getAccountInfo,
  getContractInfo: mocks.getContractInfo,
}));

const AppModalStub = {
  props: ['show'],
  emits: ['update:show'],
  template:
    '<div data-testid="modal"><button data-testid="modal-dismiss" @click="$emit(\'update:show\', false)" /><slot v-if="show" /></div>',
};
const AppButtonStub = {
  props: ['disabled', 'loading'],
  template: '<button v-bind="$attrs" :disabled="disabled" :data-loading="loading"><slot /></button>',
};
const AppAutoCompleteStub = {
  props: [
    'modelValue',
    'items',
    'sanitize',
    'findMatch',
    'decorate',
    'disableSpaces',
    'tabularNums',
  ],
  emits: ['update:modelValue'],
  template:
    '<input data-testid="input-role-holder" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};

const accountRole: ContractRole = {
  id: 'r1',
  name: 'MINTER_ROLE',
  verified: true,
  value: '0x' + '11'.repeat(32),
  holderType: 'account',
  holderAccountId: '0.0.500',
  note: 'mints',
};

async function mountModal(props: { show?: boolean; role?: ContractRole | null } = {}) {
  const wrapper = mount(RoleModal, {
    props: { show: true, role: null, ...props },
    global: {
      stubs: { AppModal: AppModalStub, AppButton: AppButtonStub, AppAutoComplete: AppAutoCompleteStub },
      provide: { [ToastManager.injectKey as symbol]: mocks.toast },
    },
  });
  await flushPromises();
  return wrapper;
}

const fill = async (wrapper: Awaited<ReturnType<typeof mountModal>>, testid: string, v: string) =>
  wrapper.find(`[data-testid="${testid}"]`).setValue(v);

const submit = async (wrapper: Awaited<ReturnType<typeof mountModal>>) => {
  await wrapper.find('form').trigger('submit');
  await flushPromises();
};

describe('RoleModal.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.networkStore.client = Client.forTestnet();
    mocks.userStore.personal = { isLoggedIn: true, id: 'local-user' };
    mocks.userStore.publicKeysToAccountsFlattened = [];
    mocks.getAllAccounts.mockResolvedValue([]);
    mocks.getContractInfo.mockResolvedValue(null);
    mocks.getAccountInfo.mockResolvedValue({ accountId: { toString: () => '0.0.700' } });
  });

  test('add mode: shows Add role title, empty fields, save disabled until a name is entered', async () => {
    const wrapper = await mountModal();

    expect(wrapper.find('h1').text()).toBe('Add role');
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('');
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeDefined();

    await fill(wrapper, 'input-role-name', 'ADMIN');
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeUndefined();
  });

  test('loads the user linked accounts for the current network', async () => {
    await mountModal();
    expect(mocks.getAllAccounts).toHaveBeenCalledWith({
      where: { user_id: 'local-user', network: 'testnet' },
    });
  });

  test('does not load linked accounts when the user is not logged in', async () => {
    mocks.userStore.personal = null;
    await mountModal();
    expect(mocks.getAllAccounts).not.toHaveBeenCalled();
  });

  test('holder suggestions merge linked and key accounts, de-duplicated, sorted, with checksums', async () => {
    mocks.getAllAccounts.mockResolvedValue([{ account_id: '0.0.20' }, { account_id: '0.0.3' }]);
    mocks.userStore.publicKeysToAccountsFlattened = ['0.0.3', '0.0.1'];
    const wrapper = await mountModal();

    const items: string[] = wrapper.findComponent(AppAutoCompleteStub).props('items');
    expect(items.map(i => i.split('-')[0])).toEqual(['0.0.1', '0.0.3', '0.0.20']);
    expect(items.every(i => /^\d+\.\d+\.\d+-[a-z]{5}$/.test(i))).toBe(true);
  });

  test('holder input sanitizer: account-id-shaped and EVM-shaped input', async () => {
    const wrapper = await mountModal();
    const sanitize = wrapper.findComponent(AppAutoCompleteStub).props('sanitize') as (v: string) => string;

    expect(sanitize('0.0.12')).toBe('0.0.12');
    expect(sanitize('0.0.12-abcde')).toContain('0.0.12');
    expect(sanitize('x.y')).not.toMatch(/[xy]/);
    expect(sanitize('0xABCDEFg')).toBe('0xabcdef');
    expect(sanitize('0x' + 'a'.repeat(60))).toHaveLength(42);
  });

  test('checksum ghost text only appears for full account ids', async () => {
    const wrapper = await mountModal();
    const decorate = wrapper.findComponent(AppAutoCompleteStub).props('decorate') as (v: string) => string;

    expect(decorate('0.0.12')).toMatch(/^-[a-z]{5}$/);
    expect(decorate('0.0')).toBe('');
    expect(decorate('0xabc')).toBe('');
  });

  test('picking an account with checksum keeps only the bare account id as the holder', async () => {
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-holder', '0.0.12-abcde');
    expect(wrapper.findComponent(AppAutoCompleteStub).props('modelValue')).toBe('0.0.12');
  });

  test('saving with a name only emits an unassigned role and closes the modal', async () => {
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', '  AUDITOR  ');
    await submit(wrapper);

    const [role] = wrapper.emitted('save')![0] as [ContractRole];
    expect(role).toMatchObject({
      name: 'AUDITOR',
      holderType: 'unassigned',
      verified: false,
      holderAccountId: undefined,
      note: undefined,
    });
    expect(role.id).toBeTruthy();
    expect(mocks.getContractInfo).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:show')![0]).toEqual([false]);
  });

  test('saving an account holder resolves it through the mirror node and stores the account id', async () => {
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.700');
    await fill(wrapper, 'input-role-note', '  who mints ');
    await submit(wrapper);

    expect(mocks.getContractInfo).toHaveBeenCalledWith('0.0.700', 'https://mirror.example');
    expect(mocks.getAccountInfo).toHaveBeenCalledWith('0.0.700', 'https://mirror.example');
    const [role] = wrapper.emitted('save')![0] as [ContractRole];
    expect(role).toMatchObject({
      name: 'MINTER',
      holderType: 'account',
      holderAccountId: '0.0.700',
      note: 'who mints',
    });
  });

  test('an EVM address holder is also looked up (it may be an account alias)', async () => {
    const wrapper = await mountModal();
    const evm = '0x' + 'ab'.repeat(20);
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', evm);
    await submit(wrapper);

    expect(mocks.getAccountInfo).toHaveBeenCalledWith(evm, 'https://mirror.example');
    expect((wrapper.emitted('save')![0][0] as ContractRole).holderAccountId).toBe('0.0.700');
  });

  test('rejects a holder that is neither an account id nor an EVM address', async () => {
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', 'nonsense');
    await submit(wrapper);

    expect(mocks.toast.error).toHaveBeenCalledWith(
      'Only account IDs are currently supported as role holders',
    );
    expect(mocks.getContractInfo).not.toHaveBeenCalled();
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  test('rejects a holder that is a contract', async () => {
    mocks.getContractInfo.mockResolvedValue({ contract_id: '0.0.700' });
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.700');
    await submit(wrapper);

    expect(mocks.toast.error).toHaveBeenCalledWith(
      'Only account IDs are currently supported as role holders',
    );
    expect(mocks.getAccountInfo).not.toHaveBeenCalled();
    expect(wrapper.emitted('save')).toBeUndefined();
    // Saving state is released so the user can retry
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeUndefined();
  });

  test('reports an account that does not exist (null result)', async () => {
    mocks.getAccountInfo.mockResolvedValue(null);
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.999');
    await submit(wrapper);

    expect(mocks.toast.error).toHaveBeenCalledWith('Account was not found on this network');
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  test('reports an account that does not exist (404 from the mirror node)', async () => {
    mocks.getAccountInfo.mockRejectedValue(
      new AxiosError('nf', 'ERR_BAD_REQUEST', undefined, undefined, { status: 404 } as any),
    );
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.999');
    await submit(wrapper);

    expect(mocks.toast.error).toHaveBeenCalledWith('Account was not found on this network');
  });

  test.each([
    ['an axios error that is not a 404', new AxiosError('x', 'E', undefined, undefined, { status: 500 } as any)],
    ['a non-axios error', new Error('network down')],
  ])('shows a lookup failure message for %s', async (_label, error) => {
    mocks.getAccountInfo.mockRejectedValue(error);
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.999');
    await submit(wrapper);

    expect(mocks.toast.error).toHaveBeenCalledWith('Could not look up the holder on the mirror node');
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  test('does nothing when the name is blank', async () => {
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', '   ');
    await submit(wrapper);
    expect(wrapper.emitted('save')).toBeUndefined();
  });

  test('ignores a second submit while a save is in flight', async () => {
    let release!: (v: unknown) => void;
    mocks.getContractInfo.mockReturnValue(new Promise(r => (release = r)));
    const wrapper = await mountModal();
    await fill(wrapper, 'input-role-name', 'MINTER');
    await fill(wrapper, 'input-role-holder', '0.0.700');

    await wrapper.find('form').trigger('submit');
    await wrapper.find('form').trigger('submit');
    expect(mocks.getContractInfo).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="button-save-role"]').attributes('disabled')).toBeDefined();

    release(null);
    await flushPromises();
    expect(wrapper.emitted('save')).toHaveLength(1);
  });

  test('edit mode: prefills an account holder and keeps role identity on save', async () => {
    const wrapper = await mountModal({ role: accountRole });

    expect(wrapper.find('h1').text()).toBe('Edit role');
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('MINTER_ROLE');
    expect((wrapper.find('[data-testid="input-role-holder"]').element as HTMLInputElement).value).toBe('0.0.500');
    expect((wrapper.find('[data-testid="input-role-note"]').element as HTMLInputElement).value).toBe('mints');

    await fill(wrapper, 'input-role-note', '');
    await submit(wrapper);

    const [role] = wrapper.emitted('save')![0] as [ContractRole];
    expect(role).toMatchObject({
      id: 'r1',
      verified: true,
      value: accountRole.value,
      name: 'MINTER_ROLE',
      holderAccountId: '0.0.700',
      note: undefined,
    });
  });

  test('edit mode: clearing the holder turns the role back to unassigned', async () => {
    const wrapper = await mountModal({ role: accountRole });
    await fill(wrapper, 'input-role-holder', '');
    await submit(wrapper);

    expect(wrapper.emitted('save')![0][0]).toMatchObject({
      id: 'r1',
      holderType: 'unassigned',
      holderAccountId: undefined,
    });
  });

  test('edit mode: prefills a contract holder reference, and unassigned roles start empty', async () => {
    const contractRole: ContractRole = {
      id: 'r2',
      name: 'C',
      verified: false,
      holderType: 'contract',
      holderContractRef: '0.0.42',
    };
    const wrapper = await mountModal({ role: contractRole });
    expect((wrapper.find('[data-testid="input-role-holder"]').element as HTMLInputElement).value).toBe('0.0.42');

    await wrapper.setProps({ role: { ...contractRole, holderContractRef: undefined } });
    expect((wrapper.find('[data-testid="input-role-holder"]').element as HTMLInputElement).value).toBe('');

    await wrapper.setProps({ role: { ...accountRole, holderAccountId: undefined } });
    expect((wrapper.find('[data-testid="input-role-holder"]').element as HTMLInputElement).value).toBe('');

    await wrapper.setProps({ role: { id: 'r3', name: 'U', verified: false, holderType: 'unassigned' } });
    expect((wrapper.find('[data-testid="input-role-holder"]').element as HTMLInputElement).value).toBe('');
  });

  test('reopening the modal resets the form from the role; hiding does not touch it', async () => {
    const wrapper = await mountModal({ show: false, role: accountRole });
    await wrapper.setProps({ show: true, role: null });
    await fill(wrapper, 'input-role-name', 'typed');
    await wrapper.setProps({ show: false });
    await wrapper.setProps({ show: true });
    expect((wrapper.find('[data-testid="input-role-name"]').element as HTMLInputElement).value).toBe('');
  });

  test('cancel, close icon and modal dismiss all request closing', async () => {
    const wrapper = await mountModal();
    await wrapper.find('i.bi-x-lg').trigger('click');
    await wrapper.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click');
    await wrapper.find('[data-testid="modal-dismiss"]').trigger('click');

    expect(wrapper.emitted('update:show')).toEqual([[false], [false], [false]]);
    expect(wrapper.emitted('save')).toBeUndefined();
  });
});
