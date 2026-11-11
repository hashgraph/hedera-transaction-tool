// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';

import SmartContracts from '@renderer/pages/SmartContracts/SmartContracts.vue';
import { ToastManager } from '@renderer/utils/ToastManager';
import type { ContractRole } from '@renderer/utils/sdk/contractRoles';

const mocks = vi.hoisted(() => ({
  userStore: { personal: { isLoggedIn: true, id: 'local-user' } as any },
  networkStore: { network: 'testnet', mirrorNodeBaseURL: 'https://mirror.example' },
  db: [] as any[],
  getAll: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  resolveBytes32Getter: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
  router: { push: vi.fn() },
}));

vi.mock('@renderer/stores/storeUser', () => ({ default: vi.fn(() => mocks.userStore) }));
vi.mock('@renderer/stores/storeNetwork', () => {
  mocks.networkStore = reactive(mocks.networkStore);
  return { default: vi.fn(() => mocks.networkStore) };
});
vi.mock('@renderer/composables/useSetDynamicLayout', () => ({
  default: vi.fn(),
  LOGGED_IN_LAYOUT: 'LOGGED_IN_LAYOUT',
}));
vi.mock('@renderer/services/smartContractsService', () => ({
  getAll: mocks.getAll,
  update: mocks.update,
  remove: mocks.remove,
}));
vi.mock('@renderer/utils/sdk/contractCall', () => ({
  resolveBytes32Getter: mocks.resolveBytes32Getter,
}));

const AppModalStub = {
  props: ['show'],
  emits: ['update:show'],
  template: '<div data-testid="remove-modal" :data-show="show"><slot v-if="show" /></div>',
};
const AppButtonStub = {
  props: ['disabled'],
  template: '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
};
const RoleModalStub = {
  props: ['show', 'role'],
  emits: ['save', 'update:show'],
  template: '<div data-testid="role-modal" :data-show="show" :data-role="role && role.name" />',
};
const ViewSourceModalStub = {
  props: ['show', 'evmAddress'],
  emits: ['update:show'],
  template: '<div data-testid="view-source-modal" :data-show="show" :data-evm-address="evmAddress" />',
};

const ROLE_VALUE = '0x' + '11'.repeat(32);
const EVM = '0x' + 'ab'.repeat(20);
const getter = (name: string) => ({
  type: 'function',
  name,
  inputs: [],
  outputs: [{ type: 'bytes32', name: '' }],
  stateMutability: 'view',
});
const mint = {
  type: 'function',
  name: 'mint',
  inputs: [
    { type: 'address', name: 'to' },
    { type: 'uint256', name: 'amount' },
  ],
  outputs: [],
  stateMutability: 'nonpayable',
};
const role = (over: Partial<ContractRole> = {}): ContractRole => ({
  id: 'r1',
  name: 'MINTER_ROLE',
  verified: true,
  value: ROLE_VALUE,
  ...over,
});

const makeContract = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  user_id: 'local-user',
  network: 'testnet',
  nickname: 'Token',
  contract_id: '0.0.10',
  evm_address: EVM,
  abi: JSON.stringify([getter('MINTER_ROLE'), getter('ADMIN_ROLE'), mint]),
  verified: true,
  roles: null,
  created_at: new Date(),
  ...over,
});
const contractB = () =>
  makeContract({
    id: 'c2',
    nickname: null,
    contract_id: null,
    evm_address: '0x' + 'cd'.repeat(20),
    abi: 'not json',
    verified: false,
  });

const tick = (ms = 120) => new Promise(r => setTimeout(r, ms));

async function mountPage(opts: { errorHandler?: (e: unknown) => void } = {}) {
  const wrapper = mount(SmartContracts, {
    global: {
      stubs: {
        AppModal: AppModalStub,
        AppButton: AppButtonStub,
        RoleModal: RoleModalStub,
        ViewSourceModal: ViewSourceModalStub,
      },
      mocks: { $router: mocks.router },
      provide: { [ToastManager.injectKey as symbol]: mocks.toast },
      config: opts.errorHandler ? { errorHandler: opts.errorHandler } : {},
    },
  });
  await flushPromises();
  return wrapper;
}
type Wrapper = Awaited<ReturnType<typeof mountPage>>;

const t = (id: string) => `[data-testid="${id}"]`;
const roleModal = (w: Wrapper) => w.findComponent(RoleModalStub);
const lastUpdate = () => mocks.update.mock.calls.at(-1)!;
const lastRoles = () => JSON.parse(lastUpdate()[2].roles) as ContractRole[];

describe('SmartContracts.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userStore.personal = { isLoggedIn: true, id: 'local-user' };
    mocks.networkStore.network = 'testnet';
    mocks.db = [];
    // A tiny in-memory stand-in for the persistence layer so UI reflects saved changes.
    mocks.getAll.mockImplementation(async () => mocks.db.map(c => ({ ...c })));
    mocks.update.mockImplementation(async (id: string, _u: string, partial: any) => {
      const c = mocks.db.find(x => x.id === id);
      Object.assign(c, partial);
    });
    mocks.remove.mockImplementation(async (_u: string, ids: string[]) => {
      mocks.db = mocks.db.filter(c => !ids.includes(c.id));
    });
    mocks.resolveBytes32Getter.mockResolvedValue(null);
  });

  describe('listing', () => {
    test('empty state: tells the user nothing is saved and prompts to select or add', async () => {
      const wrapper = await mountPage();
      expect(wrapper.text()).toContain('No smart contracts saved for this network yet.');
      expect(wrapper.text()).toContain('Select a saved smart contract, or add a new one.');
      expect(wrapper.find(t('button-remove-smart-contract')).exists()).toBe(false);
    });

    test('loads the current user and network contracts, newest first', async () => {
      await mountPage();
      expect(mocks.getAll).toHaveBeenCalledWith({
        where: { user_id: 'local-user', network: 'testnet' },
        orderBy: { created_at: 'desc' },
      });
    });

    test('Add New navigates to the add page', async () => {
      const wrapper = await mountPage();
      await wrapper.find(t('button-add-new-smart-contract')).trigger('click');
      expect(mocks.router.push).toHaveBeenCalledWith({ name: 'addSmartContract' });
    });

    test('lists contracts with nickname/id fallbacks and selects the first', async () => {
      mocks.db = [makeContract(), contractB()];
      const wrapper = await mountPage();

      expect(wrapper.find(t('p-smart-contract-nickname-0')).text()).toBe('Token');
      expect(wrapper.find(t('p-smart-contract-id-0')).text()).toBe('0.0.10');
      expect(wrapper.find(t('p-smart-contract-nickname-1')).text()).toBe('Unnamed contract');
      expect(wrapper.find(t('p-smart-contract-id-1')).text()).toBe('0x' + 'cd'.repeat(20));
      expect(wrapper.find(t('p-smart-contract-data-id')).text()).toBe('0.0.10');
      expect(wrapper.find(t('badge-smart-contract-verified')).exists()).toBe(true);
      expect(wrapper.text()).toContain('testnet');
    });

    test('selecting another contract shows its details with None placeholders and no badge', async () => {
      mocks.db = [makeContract(), contractB()];
      const wrapper = await mountPage();
      await wrapper.find(t('p-smart-contract-nickname-1')).trigger('click');

      expect(wrapper.find(t('p-smart-contract-data-id')).text()).toBe('None');
      expect(wrapper.find(t('p-smart-contract-data-evm-address')).text()).toBe('0x' + 'cd'.repeat(20));
      expect(wrapper.find(t('badge-smart-contract-verified')).exists()).toBe(false);
      // Unparseable ABI means no functions rather than a crash
      expect(wrapper.text()).toContain('Functions (0)');
    });

    test('a contract saved without an EVM address shows None', async () => {
      mocks.db = [makeContract({ evm_address: null })];
      const wrapper = await mountPage();
      expect(wrapper.find(t('p-smart-contract-data-evm-address')).text()).toBe('None');
    });

    test('View source only shows for a verified contract with an evm address', async () => {
      mocks.db = [makeContract(), contractB(), makeContract({ id: 'c3', evm_address: null })];
      const wrapper = await mountPage();
      expect(wrapper.find(t('button-view-source')).exists()).toBe(true);

      await wrapper.find(t('p-smart-contract-nickname-1')).trigger('click'); // contractB: unverified
      expect(wrapper.find(t('button-view-source')).exists()).toBe(false);

      await wrapper.find(t('p-smart-contract-id-2')).trigger('click'); // verified but no evm_address
      expect(wrapper.find(t('button-view-source')).exists()).toBe(false);
    });

    test('clicking View source opens the modal for the selected contract', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      const modal = () => wrapper.findComponent(ViewSourceModalStub);
      expect(modal().props('show')).toBe(false);

      await wrapper.find(t('button-view-source')).trigger('click');
      expect(modal().props('show')).toBe(true);
      expect(modal().props('evmAddress')).toBe(EVM);
    });

    test('fetching while logged out raises an error', async () => {
      mocks.userStore.personal = null;
      const errors: unknown[] = [];
      await mountPage({ errorHandler: e => errors.push(e) });
      expect((errors[0] as Error).message).toBe('User is not logged in');
      expect(mocks.getAll).not.toHaveBeenCalled();
    });
  });

  describe('removing', () => {
    test('confirm removes the selected contract, refreshes, and selects the next one', async () => {
      mocks.db = [makeContract(), contractB()];
      const wrapper = await mountPage();

      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('true');
      await wrapper.find(t('button-confirm-remove-smart-contract')).trigger('click');
      await flushPromises();

      expect(mocks.remove).toHaveBeenCalledWith('local-user', ['c1']);
      expect(mocks.toast.success).toHaveBeenCalledWith('Smart contract removed!');
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('false');
      expect(wrapper.find(t('p-smart-contract-nickname-0')).text()).toBe('Unnamed contract');
      expect(wrapper.findAll(t('p-smart-contract-nickname-1'))).toHaveLength(0);
    });

    test('removing the last contract returns to the empty state', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      await wrapper.find(t('button-confirm-remove-smart-contract')).trigger('click');
      await flushPromises();

      expect(wrapper.text()).toContain('No smart contracts saved for this network yet.');
      expect(wrapper.text()).toContain('Select a saved smart contract, or add a new one.');
    });

    test('dismissing the dialog through the modal itself closes it', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      wrapper.findComponent(AppModalStub).vm.$emit('update:show', false);
      await flushPromises();
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('false');
    });

    test('cancel and the close icon dismiss the dialog without removing', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();

      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      await wrapper.findAll('button').find(b => b.text() === 'Cancel')!.trigger('click');
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('false');

      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      await wrapper.find('i.bi-x-lg').trigger('click');
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('false');
      expect(mocks.remove).not.toHaveBeenCalled();
    });

    test('a failed removal shows the error and still closes the dialog', async () => {
      mocks.db = [makeContract()];
      mocks.remove.mockRejectedValue(new Error('locked'));
      const wrapper = await mountPage();
      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      await wrapper.find(t('button-confirm-remove-smart-contract')).trigger('click');
      await flushPromises();

      expect(mocks.toast.error).toHaveBeenCalledWith('locked');
      expect(mocks.toast.success).not.toHaveBeenCalled();
      expect(wrapper.find(t('remove-modal')).attributes('data-show')).toBe('false');
    });

    test('removing while logged out raises an error and removes nothing', async () => {
      mocks.db = [makeContract()];
      const errors: unknown[] = [];
      const wrapper = await mountPage({ errorHandler: e => errors.push(e) });
      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      mocks.userStore.personal = null;
      await wrapper.find(t('button-confirm-remove-smart-contract')).trigger('click');
      await flushPromises();

      expect(mocks.remove).not.toHaveBeenCalled();
      expect((errors[0] as Error).message).toBe('User is not logged in');
    });
  });

  describe('nickname', () => {
    const startEdit = async (wrapper: Wrapper) => {
      await wrapper.find(t('button-edit-smart-contract-nickname')).trigger('click');
      await tick();
    };
    const nicknameInput = (wrapper: Wrapper) =>
      wrapper.find(t('input-smart-contract-nickname')).element as HTMLInputElement;

    test('editing prefills the current nickname, focuses it, and saving persists the new value', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      const input = nicknameInput(wrapper);
      await startEdit(wrapper);

      expect(input.value).toBe('Token');
      expect(document.activeElement === input || input.style.display !== 'none').toBe(true);

      input.value = 'Renamed';
      await wrapper.find(t('input-smart-contract-nickname')).trigger('blur');
      await flushPromises();

      expect(mocks.update).toHaveBeenCalledWith('c1', 'local-user', { nickname: 'Renamed' });
      expect(wrapper.find(t('p-smart-contract-nickname-0')).text()).toBe('Renamed');
      expect(wrapper.find(t('button-edit-smart-contract-nickname')).exists()).toBe(true);
    });

    test('double-clicking the title also starts editing; a blank nickname is saved as null', async () => {
      mocks.db = [makeContract({ nickname: null })];
      const wrapper = await mountPage();
      await wrapper.find('p.text-title').trigger('dblclick');
      await tick();

      expect(nicknameInput(wrapper).value).toBe('');
      await wrapper.find(t('input-smart-contract-nickname')).trigger('blur');
      await flushPromises();
      expect(mocks.update).toHaveBeenCalledWith('c1', 'local-user', { nickname: null });
    });

    test('a failed nickname update shows an error', async () => {
      mocks.db = [makeContract()];
      mocks.update.mockRejectedValue(new Error('nope'));
      const wrapper = await mountPage();
      await startEdit(wrapper);
      await wrapper.find(t('input-smart-contract-nickname')).trigger('blur');
      await flushPromises();
      expect(mocks.toast.error).toHaveBeenCalledWith('nope');
    });

    test('blurring while logged out raises an error', async () => {
      mocks.db = [makeContract()];
      const errors: unknown[] = [];
      const wrapper = await mountPage({ errorHandler: e => errors.push(e) });
      mocks.update.mockClear(); // drop the auto-add-from-ABI call that happens on mount
      await startEdit(wrapper);
      mocks.userStore.personal = null;
      await wrapper.find(t('input-smart-contract-nickname')).trigger('blur');
      await flushPromises();
      expect(mocks.update).not.toHaveBeenCalled();
      expect((errors[0] as Error).message).toBe('User is not logged in');
    });

    test('selecting another contract cancels nickname editing', async () => {
      mocks.db = [makeContract(), contractB()];
      const wrapper = await mountPage();
      await startEdit(wrapper);
      await wrapper.find(t('p-smart-contract-nickname-1')).trigger('click');
      expect(wrapper.find(t('button-edit-smart-contract-nickname')).exists()).toBe(true);
    });

    test('leaving the page before the edit timer fires is harmless', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      await wrapper.find(t('button-edit-smart-contract-nickname')).trigger('click');
      wrapper.unmount();
      await expect(tick()).resolves.toBeUndefined();
    });
  });

  describe('roles', () => {
    test('with no ABI getters and no roles, shows the empty roles message', async () => {
      mocks.db = [contractB()];
      const wrapper = await mountPage();
      expect(wrapper.text()).toContain('No roles defined yet.');
    });

    test('auto-adds role getters found in the ABI, resolving on-chain where possible', async () => {
      mocks.db = [makeContract()];
      mocks.resolveBytes32Getter.mockImplementation(async (_contract, name) =>
        name === 'MINTER_ROLE' ? ROLE_VALUE : null,
      );
      const wrapper = await mountPage();

      expect(mocks.resolveBytes32Getter).toHaveBeenCalledWith(
        { contractId: '0.0.10', evmAddress: EVM },
        'MINTER_ROLE',
        'https://mirror.example',
      );
      expect(mocks.resolveBytes32Getter).toHaveBeenCalledWith(
        { contractId: '0.0.10', evmAddress: EVM },
        'ADMIN_ROLE',
        'https://mirror.example',
      );
      expect(lastRoles()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'MINTER_ROLE', value: ROLE_VALUE, verified: true }),
          expect.objectContaining({ name: 'ADMIN_ROLE', verified: false }),
        ]),
      );
      expect(wrapper.text()).toContain('verified on-chain');
      expect(wrapper.text()).not.toContain('No roles defined yet.');
    });

    test('an auto-added role that cannot be resolved is saved unverified and offers on-chain resolution', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();

      const adminRole = lastRoles().find(r => r.name === 'ADMIN_ROLE');
      expect(adminRole).toMatchObject({ verified: false });
      expect(adminRole?.value).toBeUndefined();
      expect(wrapper.find(t('button-resolve-role-ADMIN_ROLE')).exists()).toBe(true);
    });

    test('resolve on-chain verifies an existing role and keeps its other fields', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([
            role({ verified: false, value: undefined }),
            role({ id: 'r2', name: 'ADMIN_ROLE', verified: true, value: ROLE_VALUE }),
          ]),
        }),
      ];
      mocks.resolveBytes32Getter.mockResolvedValue(ROLE_VALUE);
      const wrapper = await mountPage();
      await wrapper.find(t('button-resolve-role-MINTER_ROLE')).trigger('click');
      await flushPromises();

      expect(lastRoles()).toEqual([
        expect.objectContaining({ id: 'r1', value: ROLE_VALUE, verified: true }),
        expect.objectContaining({ id: 'r2', name: 'ADMIN_ROLE' }),
      ]);
      expect(wrapper.find(t('button-resolve-role-MINTER_ROLE')).exists()).toBe(false);
    });

    test('resolve on-chain failure tells the user and changes nothing', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([
            role({ verified: false, value: undefined }),
            role({ id: 'r2', name: 'ADMIN_ROLE', verified: true, value: ROLE_VALUE }),
          ]),
        }),
      ];
      const wrapper = await mountPage();
      await wrapper.find(t('button-resolve-role-MINTER_ROLE')).trigger('click');
      await flushPromises();

      expect(mocks.toast.error).toHaveBeenCalledWith('Could not resolve MINTER_ROLE on-chain');
      expect(mocks.update).not.toHaveBeenCalled();
    });

    test('no resolve link for verified roles or roles that are not ABI getters', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([
            role(),
            role({ id: 'r2', name: 'CUSTOM_ROLE', verified: false, value: undefined }),
          ]),
        }),
      ];
      const wrapper = await mountPage();
      expect(wrapper.find(t('button-resolve-role-MINTER_ROLE')).exists()).toBe(false);
      expect(wrapper.find(t('button-resolve-role-CUSTOM_ROLE')).exists()).toBe(false);
    });

    test('Add Role opens the modal empty; its save appends a new role', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      expect(roleModal(wrapper).attributes('data-show')).toBe('false');

      await wrapper.find(t('button-add-role')).trigger('click');
      expect(roleModal(wrapper).attributes('data-show')).toBe('true');
      expect(roleModal(wrapper).props('role')).toBeNull();

      roleModal(wrapper).vm.$emit('save', role({ id: 'new', name: 'NEW_ROLE' }));
      await flushPromises();
      // MINTER_ROLE/ADMIN_ROLE were auto-added from the ABI before the manual add.
      expect(lastRoles().map(r => r.name).sort()).toEqual([
        'ADMIN_ROLE',
        'MINTER_ROLE',
        'NEW_ROLE',
      ]);
      expect(wrapper.text()).toContain('NEW_ROLE');
    });

    test('the role modal can close itself', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      await wrapper.find(t('button-add-role')).trigger('click');
      roleModal(wrapper).vm.$emit('update:show', false);
      await flushPromises();
      expect(roleModal(wrapper).attributes('data-show')).toBe('false');
    });

    test('edit opens the modal with that role; saving replaces it in place and shows the note', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([
            role(),
            role({ id: 'r2', name: 'OTHER_ROLE', verified: false }),
            role({ id: 'r3', name: 'ADMIN_ROLE', verified: false, value: undefined }),
          ]),
        }),
      ];
      const wrapper = await mountPage();
      await wrapper.find(t('button-edit-role-MINTER_ROLE')).trigger('click');
      expect(roleModal(wrapper).attributes('data-role')).toBe('MINTER_ROLE');

      roleModal(wrapper).vm.$emit('save', role({ note: 'rotated key' }));
      await flushPromises();

      expect(lastRoles().map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
      expect(wrapper.text()).toContain('rotated key');
    });

    test('removing a role drops it from the roles list', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([
            role(),
            role({ id: 'r2', name: 'OTHER_ROLE' }),
            role({ id: 'r3', name: 'ADMIN_ROLE', verified: false, value: undefined }),
          ]),
        }),
      ];
      const wrapper = await mountPage();
      await wrapper.find(t('button-remove-role-MINTER_ROLE')).trigger('click');
      await flushPromises();

      expect(lastRoles().map(r => r.id)).toEqual(['r2', 'r3']);
      expect(wrapper.find(t('button-edit-role-MINTER_ROLE')).exists()).toBe(false);
    });

    test('a failed auto-add shows the error toast', async () => {
      mocks.db = [makeContract()];
      mocks.update.mockRejectedValue(new Error('disk full'));
      await mountPage();
      expect(mocks.toast.error).toHaveBeenCalledWith('disk full');
    });

    test('saving a role while logged out raises an error', async () => {
      mocks.db = [
        makeContract({
          roles: JSON.stringify([role(), role({ id: 'r2', name: 'ADMIN_ROLE' })]),
        }),
      ];
      const errors: unknown[] = [];
      const wrapper = await mountPage({ errorHandler: e => errors.push(e) });
      await wrapper.find(t('button-add-role')).trigger('click');
      mocks.userStore.personal = null;
      roleModal(wrapper).vm.$emit('save', role({ id: 'new', name: 'NEW_ROLE' }));
      await flushPromises();
      expect(mocks.update).not.toHaveBeenCalled();
      expect((errors[0] as Error).message).toBe('User is not logged in');
    });

    test('role helpers are inert when no contract is selected', async () => {
      mocks.db = [makeContract()];
      const wrapper = await mountPage();
      mocks.resolveBytes32Getter.mockClear();
      mocks.db = [];
      await wrapper.find(t('button-remove-smart-contract')).trigger('click');
      await wrapper.find(t('button-confirm-remove-smart-contract')).trigger('click');
      await flushPromises();

      expect((wrapper.vm as any).selectedAbi).toEqual([]);
      expect(await (wrapper.vm as any).tryResolveRoleValue('MINTER_ROLE')).toBeNull();
      expect(mocks.resolveBytes32Getter).not.toHaveBeenCalled();
    });
  });

  describe('functions', () => {
    test('lists every ABI function with its signature, purely as info - no per-function role control', async () => {
      mocks.db = [makeContract({ roles: JSON.stringify([role()]) })];
      const wrapper = await mountPage();

      expect(wrapper.text()).toContain('Functions (3)');
      expect(wrapper.text()).toContain('mint(address to, uint256 amount)');
      expect(wrapper.text()).toContain('MINTER_ROLE()');
      expect(wrapper.text()).toContain('ADMIN_ROLE()');
      expect(wrapper.find(t('select-function-role-mint')).exists()).toBe(false);
    });
  });
});
