// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import {
  AccountId,
  ContractCreateTransaction,
  ContractFunctionParameters,
  Hbar,
  KeyList,
  PrivateKey,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import { TransactionStatus, type ITransactionFull } from '@shared/interfaces';

import ContractCreateDetails from '@renderer/components/Transaction/Details/ContractCreateDetails.vue';

/* Mocks */
const userState = reactive<{ personal: unknown }>({ personal: null });
const networkState = reactive({ network: 'testnet', mirrorNodeBaseURL: 'https://mirror.example' });

vi.mock('@renderer/stores/storeUser', () => ({ default: () => userState }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

const getAllMock = vi.fn();
vi.mock('@renderer/services/smartContractsService', () => ({
  getAll: (...args: unknown[]) => getAllMock(...args),
}));

const lookupTransactionMock = vi.fn();
const lookupPublicKeyOwnerMock = vi.fn();
vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: {
    inject: () => ({
      mirrorTransactionById: { lookup: (...args: unknown[]) => lookupTransactionMock(...args) },
      backendPublicKeyOwner: { lookup: (...args: unknown[]) => lookupPublicKeyOwnerMock(...args) },
    }),
  },
}));

const formatPublicKeyMock = vi.fn();
vi.mock('@renderer/utils', async importOriginal => {
  const actual = await importOriginal<typeof import('@renderer/utils')>();
  return { ...actual, formatPublicKey: (...args: unknown[]) => formatPublicKeyMock(...args) };
});

const ABI_WITH_CTOR = [
  {
    type: 'constructor',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'supply', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  },
];
const ADDR = '0x' + '12'.repeat(20);

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    contract_id: '0.0.5000',
    evm_address: null,
    abi: JSON.stringify(ABI_WITH_CTOR),
    ...overrides,
  };
}

const ctorParams = () =>
  new ContractFunctionParameters().addAddress(ADDR).addUint256(7)._build();

function withTxId(tx: ContractCreateTransaction) {
  tx.setTransactionId(
    TransactionId.withValidStart(AccountId.fromString('0.0.2'), new Timestamp(1700000000, 0)),
  );
  return tx;
}

async function mountDetails(transaction: unknown, organizationTransaction: unknown = null) {
  const wrapper = mount(ContractCreateDetails, {
    props: {
      transaction: transaction as never,
      organizationTransaction: organizationTransaction as ITransactionFull | null,
    },
    global: {
      stubs: { KeyStructureModal: true, AppButton: true },
      mocks: { $router: { push: vi.fn() } },
    },
  });
  await flushPromises();
  return wrapper;
}

const byId = (w: ReturnType<typeof mount>, id: string) =>
  w.find(`[data-testid="p-contract-create-details-${id}"]`);

describe('ContractCreateDetails.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userState.personal = { isLoggedIn: true, id: 'u1' };
    networkState.network = 'testnet';
    networkState.mirrorNodeBaseURL = 'https://mirror.example';
    getAllMock.mockResolvedValue([]);
  });

  describe('new contract id + Link Contract', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    test('resolves the new contract id and offers to link it', async () => {
      lookupTransactionMock.mockResolvedValue({ transactions: [{ entity_id: '0.0.5000' }] });
      vi.useFakeTimers();
      const wrapper = await mountDetails(withTxId(new ContractCreateTransaction()));
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(byId(wrapper, 'new-contract-id').text()).toBe('0.0.5000');
      expect(
        wrapper.find('[data-testid="button-contract-create-details-link-contract"]').exists(),
      ).toBe(true);
      expect(byId(wrapper, 'already-linked').exists()).toBe(false);
    });

    test('shows "already linked" instead of the button when a matching saved contract exists', async () => {
      lookupTransactionMock.mockResolvedValue({ transactions: [{ entity_id: '0.0.5000' }] });
      getAllMock.mockResolvedValue([makeContract()]);
      vi.useFakeTimers();
      const wrapper = await mountDetails(withTxId(new ContractCreateTransaction()));
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(byId(wrapper, 'already-linked').exists()).toBe(true);
      expect(
        wrapper.find('[data-testid="button-contract-create-details-link-contract"]').exists(),
      ).toBe(false);
    });

    test('skips the lookup for an organization transaction still pending execution', async () => {
      const org = { status: TransactionStatus.WAITING_FOR_SIGNATURES } as unknown as ITransactionFull;
      const wrapper = await mountDetails(withTxId(new ContractCreateTransaction()), org);
      expect(lookupTransactionMock).not.toHaveBeenCalled();
      expect(byId(wrapper, 'new-contract-id').exists()).toBe(false);
    });

    test('fetches immediately (no retry delay) for an already-executed organization transaction', async () => {
      lookupTransactionMock.mockResolvedValue({ transactions: [{ entity_id: '0.0.5000' }] });
      const org = { status: TransactionStatus.EXECUTED } as unknown as ITransactionFull;
      const wrapper = await mountDetails(withTxId(new ContractCreateTransaction()), org);
      expect(byId(wrapper, 'new-contract-id').text()).toBe('0.0.5000');
    });
  });

  describe('admin key', () => {
    test('shows an explicit "immutable" message when no admin key is set', async () => {
      const wrapper = await mountDetails(new ContractCreateTransaction());
      expect(byId(wrapper, 'admin-key').text()).toContain('immutable');
    });

    test('shows the raw key and loading state while ownership is pending, then the owner', async () => {
      let resolve!: (value: string) => void;
      formatPublicKeyMock.mockReturnValue(
        new Promise<string>(r => {
          resolve = r;
        }),
      );
      const pk = PrivateKey.generateED25519().publicKey;
      const wrapper = await mountDetails(new ContractCreateTransaction().setAdminKey(pk));
      expect(wrapper.get('[role="status"]').text()).toContain('Loading');
      expect(wrapper.text()).toContain(pk.toStringRaw());
      resolve('Owner (abc)');
      await flushPromises();
      expect(byId(wrapper, 'admin-key').text()).toContain('Owner');
      expect(wrapper.find('[role="status"]').exists()).toBe(false);
    });

    test('a threshold (KeyList) admin key shows a "See details" link instead of raw key text', async () => {
      const keys = [1, 2, 3].map(() => PrivateKey.generateED25519().publicKey);
      const wrapper = await mountDetails(
        new ContractCreateTransaction().setAdminKey(new KeyList(keys, 2)),
      );
      expect(byId(wrapper, 'admin-key').text()).toContain('See details');
    });
  });

  describe('bytecode', () => {
    test('shows the File ID when bytecode is sourced from a file', async () => {
      const wrapper = await mountDetails(
        new ContractCreateTransaction().setBytecodeFileId('0.0.150'),
      );
      expect(byId(wrapper, 'bytecode-file-id').text()).toContain('0.0.150');
      expect(byId(wrapper, 'bytecode-unavailable').exists()).toBe(false);
    });

    test('shows the temporary-limitation message when there is no bytecodeFileId (inline bytecode case)', async () => {
      const wrapper = await mountDetails(
        new ContractCreateTransaction().setBytecode(new Uint8Array([0x60, 0x80])),
      );
      expect(byId(wrapper, 'bytecode-unavailable').exists()).toBe(true);
      expect(byId(wrapper, 'bytecode-file-id').exists()).toBe(false);
    });
  });

  describe('plain fields', () => {
    test('gas, initial balance, memo, auto renew account, max automatic token associations', async () => {
      const wrapper = await mountDetails(
        new ContractCreateTransaction()
          .setGas(123456)
          .setInitialBalance(new Hbar(2))
          .setContractMemo('my contract')
          .setAutoRenewAccountId('0.0.9')
          .setMaxAutomaticTokenAssociations(5),
      );
      expect(byId(wrapper, 'gas').text()).toBe('123456');
      expect(byId(wrapper, 'initial-balance').exists()).toBe(true);
      expect(byId(wrapper, 'memo').text()).toBe('my contract');
      expect(byId(wrapper, 'auto-renew-account').text()).toContain('0.0.9');
      expect(wrapper.text()).toContain('5');
    });

    test('staking to an account and declining rewards', async () => {
      const wrapper = await mountDetails(
        new ContractCreateTransaction().setStakedAccountId('0.0.9').setDeclineStakingReward(true),
      );
      expect(byId(wrapper, 'staking').text()).toBe('Account 0.0.9');
      expect(byId(wrapper, 'accept-rewards').text()).toBe('No');
    });

    test('staking to a node', async () => {
      const wrapper = await mountDetails(new ContractCreateTransaction().setStakedNodeId(0));
      expect(byId(wrapper, 'staking').text()).toBe('Node 0');
    });
  });

  describe('constructor parameters', () => {
    test('shows raw bytes with a "not created yet" message when there is no resolved contract id', async () => {
      const wrapper = await mountDetails(
        new ContractCreateTransaction().setConstructorParameters(ctorParams()),
      );
      expect(byId(wrapper, 'constructor-args-pending').exists()).toBe(true);
      expect(wrapper.text()).toContain('hasn\'t been created yet');
    });

    test('decodes constructor args once the contract id resolves and a matching saved ABI exists', async () => {
      lookupTransactionMock.mockResolvedValue({ transactions: [{ entity_id: '0.0.5000' }] });
      getAllMock.mockResolvedValue([makeContract()]);
      vi.useFakeTimers();
      const wrapper = await mountDetails(
        withTxId(new ContractCreateTransaction().setConstructorParameters(ctorParams())),
      );
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      vi.useRealTimers();
      expect(byId(wrapper, 'constructor-args').text()).toBe(
        `address owner = ${ADDR}, uint256 supply = 7`,
      );
    });

    test('shows a "no saved ABI" message once resolved but with no matching saved contract', async () => {
      lookupTransactionMock.mockResolvedValue({ transactions: [{ entity_id: '0.0.5000' }] });
      getAllMock.mockResolvedValue([]);
      vi.useFakeTimers();
      const wrapper = await mountDetails(
        withTxId(new ContractCreateTransaction().setConstructorParameters(ctorParams())),
      );
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      vi.useRealTimers();
      expect(byId(wrapper, 'constructor-args-no-abi').exists()).toBe(true);
    });

    test('is not shown at all for a no-arg constructor', async () => {
      const wrapper = await mountDetails(new ContractCreateTransaction());
      expect(wrapper.text()).not.toContain('Constructor Parameters');
    });
  });
});
