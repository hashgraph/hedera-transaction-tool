// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import {
  AccountId,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  Timestamp,
  TransactionId,
  TransferTransaction,
} from '@hiero-ledger/sdk';

import { TransactionStatus, type ITransactionFull } from '@shared/interfaces';

import ContractExecuteDetails from '@renderer/components/Transaction/Details/ContractExecuteDetails.vue';

const userState = reactive<{ personal: unknown }>({ personal: null });
const networkState = reactive({ network: 'testnet', mirrorNodeBaseURL: 'https://mirror.example' });

vi.mock('@renderer/stores/storeUser', () => ({ default: () => userState }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

const getAllMock = vi.fn();
vi.mock('@renderer/services/smartContractsService', () => ({
  getAll: (...args: unknown[]) => getAllMock(...args),
}));

const lookupMock = vi.fn();
vi.mock('@renderer/caches/AppCache.ts', () => ({
  AppCache: {
    inject: () => ({
      mirrorContractResultByTransactionId: { lookup: (...args: unknown[]) => lookupMock(...args) },
    }),
  },
}));

const ABI = [
  {
    type: 'function',
    name: 'mint',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setName',
    inputs: [{ name: 'n', type: 'string' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setIds',
    inputs: [{ name: 'ids', type: 'uint256[]' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
];

const ADDR = '0x' + '12'.repeat(20);

function makeContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    contract_id: '0.0.1001',
    evm_address: null,
    abi: JSON.stringify(ABI),
    ...overrides,
  };
}

const mintParams = () =>
  new ContractFunctionParameters().addAddress(ADDR).addUint256(7)._build('mint');
const nameParams = () => new ContractFunctionParameters().addString('hi')._build('setName');
const idsParams = () => new ContractFunctionParameters().addUint256Array([1, 2])._build('setIds');

function makeTx(opts: { id?: ContractId; gas?: number; payable?: Hbar; params?: Uint8Array } = {}) {
  const tx = new ContractExecuteTransaction();
  tx.setContractId(opts.id ?? ContractId.fromString('0.0.1001'));
  if (opts.gas !== undefined) tx.setGas(opts.gas);
  if (opts.payable) tx.setPayableAmount(opts.payable);
  if (opts.params) tx.setFunctionParameters(opts.params);
  return tx;
}

async function mountDetails(transaction: unknown, organizationTransaction: unknown = null) {
  const wrapper = mount(ContractExecuteDetails, {
    props: {
      transaction: transaction as never,
      organizationTransaction: organizationTransaction as ITransactionFull | null,
    },
  });
  await flushPromises();
  return wrapper;
}

const byId = (w: ReturnType<typeof mount>, id: string) =>
  w.find(`[data-testid="p-contract-execute-details-${id}"]`);

describe('ContractExecuteDetails.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userState.personal = { isLoggedIn: true, id: 'u1' };
    getAllMock.mockResolvedValue([makeContract()]);
    lookupMock.mockResolvedValue(null);
  });

  test('renders nothing for a non ContractExecute transaction', async () => {
    const wrapper = await mountDetails(new TransferTransaction());
    expect(wrapper.find('.row').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('Contract ID');
  });

  test('shows contract id and payable amount, but never gas (a cap, like max fee, not shown in details)', async () => {
    const wrapper = await mountDetails(makeTx({ gas: 250000, payable: new Hbar(5) }));
    expect(byId(wrapper, 'contract-id').text()).toBe('0.0.1001');
    expect(byId(wrapper, 'payable-amount').text()).toContain('5');
    expect(byId(wrapper, 'gas').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('250000');
  });

  test('shows a genuine (non-long-zero) EVM-backed contract id as "0x...", not the SDK\'s raw "shard.realm.<hex>" toString()', async () => {
    const addr = 'abcdef1234567890abcdef1234567890abcdef12';
    const wrapper = await mountDetails(makeTx({ id: ContractId.fromEvmAddress(0, 0, `0x${addr}`) }));
    expect(byId(wrapper, 'contract-id').text()).toBe(`0x${addr}`);
  });

  test('shows None for a missing contract id and hides payable amount when unset', async () => {
    const wrapper = await mountDetails(new ContractExecuteTransaction());
    expect(byId(wrapper, 'contract-id').text()).toBe('None');
    expect(byId(wrapper, 'payable-amount').exists()).toBe(false);
    // no contract id -> nothing to match, no calldata -> no ABI message
    expect(byId(wrapper, 'no-abi').exists()).toBe(true);
  });

  test('hides payable amount when explicitly set to 0 (e.g. after a protobuf bytes round-trip, which has no "unset" for a plain numeric field)', async () => {
    const wrapper = await mountDetails(makeTx({ payable: new Hbar(0) }));
    expect(byId(wrapper, 'payable-amount').exists()).toBe(false);
  });

  test('queries saved contracts for the current user and network', async () => {
    await mountDetails(makeTx());
    expect(getAllMock).toHaveBeenCalledWith({ where: { user_id: 'u1', network: 'testnet' } });
  });

  test('does not query when not logged in and shows the no-ABI hint', async () => {
    userState.personal = null;
    const wrapper = await mountDetails(makeTx({ params: mintParams() }));
    expect(getAllMock).not.toHaveBeenCalled();
    expect(byId(wrapper, 'no-abi').text()).toContain('No saved ABI for this contract');
    expect(byId(wrapper, 'function').exists()).toBe(false);
  });

  test('decodes the called function and its static arguments', async () => {
    const wrapper = await mountDetails(makeTx({ params: mintParams() }));
    expect(byId(wrapper, 'function').text()).toBe(
      `mint(address to = ${ADDR}, uint256 amount = 7)`,
    );
    expect(wrapper.text()).not.toContain('full calldata');
  });

  test('decodes a string argument (head/tail encoding), not just static types', async () => {
    const wrapper = await mountDetails(makeTx({ params: nameParams() }));
    expect(byId(wrapper, 'function').text()).toBe('setName(string n = hi)');
    expect(wrapper.text()).not.toContain('full calldata');
  });

  test('identifies the function but shows raw calldata when args are not decodable (array param)', async () => {
    const params = idsParams();
    const wrapper = await mountDetails(makeTx({ params }));
    expect(byId(wrapper, 'function').text()).toBe('setIds(...)');
    expect(wrapper.text()).toContain('full calldata: 0x');
    expect(wrapper.text()).toContain(Buffer.from(params).toString('hex'));
  });

  test('says the call could not be matched when the selector is not in the ABI', async () => {
    const other = new ContractFunctionParameters().addUint256(1)._build('burn');
    const wrapper = await mountDetails(makeTx({ params: other }));
    expect(byId(wrapper, 'function').exists()).toBe(false);
    expect(byId(wrapper, 'no-abi').exists()).toBe(false);
    expect(wrapper.text()).toContain('Could not match this call to a function in the saved ABI.');
  });

  test('a matching contract without calldata cannot decode', async () => {
    const wrapper = await mountDetails(makeTx());
    expect(byId(wrapper, 'function').exists()).toBe(false);
    expect(wrapper.text()).toContain('Could not match this call');
  });

  test('corrupt saved ABI is treated as no ABI', async () => {
    getAllMock.mockResolvedValue([makeContract({ abi: '{bad' })]);
    const wrapper = await mountDetails(makeTx({ params: mintParams() }));
    expect(byId(wrapper, 'no-abi').exists()).toBe(true);
  });

  describe('matching saved contracts to the transaction target', () => {
    const evmOf = (id: string) => ContractId.fromString(id).toEvmAddress();

    test('by "0.0.X" id when the tx targets the contract by EVM address', async () => {
      getAllMock.mockResolvedValue([makeContract({ contract_id: '0.0.1001' })]);
      const tx = makeTx({
        id: ContractId.fromEvmAddress(0, 0, evmOf('0.0.1001')),
        params: mintParams(),
      });
      const wrapper = await mountDetails(tx);
      expect(byId(wrapper, 'function').exists()).toBe(true);
    });

    test('by an equivalent but textually different "0.0.X" id (same EVM address)', async () => {
      getAllMock.mockResolvedValue([makeContract({ contract_id: '0.0.01001' })]);
      const wrapper = await mountDetails(makeTx({ params: mintParams() }));
      expect(byId(wrapper, 'function').exists()).toBe(true);
    });

    test.each([
      ['with 0x prefix', (a: string) => `0x${a}`],
      ['without 0x prefix', (a: string) => a],
      ['uppercase', (a: string) => `0x${a.toUpperCase()}`],
    ])('by saved evm address %s', async (_n, fmt) => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: null, evm_address: fmt(evmOf('0.0.1001')) }),
      ]);
      const wrapper = await mountDetails(makeTx({ params: mintParams() }));
      expect(byId(wrapper, 'function').exists()).toBe(true);
    });

    test('an unparseable saved contract id falls through to the evm address check', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: 'not-an-id', evm_address: evmOf('0.0.1001') }),
      ]);
      const wrapper = await mountDetails(makeTx({ params: mintParams() }));
      expect(byId(wrapper, 'function').exists()).toBe(true);
    });

    test('by a saved contract recorded under a genuine (non-long-zero) EVM address', async () => {
      const addr = 'abcdef1234567890abcdef1234567890abcdef12';
      getAllMock.mockResolvedValue([makeContract({ contract_id: null, evm_address: addr })]);
      const tx = makeTx({
        id: ContractId.fromEvmAddress(0, 0, `0x${addr}`),
        params: mintParams(),
      });
      const wrapper = await mountDetails(tx);
      expect(byId(wrapper, 'function').exists()).toBe(true);
    });

    test('a different contract with a different evm address does not match', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: '0.0.2002', evm_address: evmOf('0.0.3003') }),
        makeContract({ contract_id: null, evm_address: null }),
      ]);
      const wrapper = await mountDetails(makeTx({ params: mintParams() }));
      expect(byId(wrapper, 'no-abi').exists()).toBe(true);
    });
  });

  describe('execution result', () => {
    const resultAbi = [
      {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ name: 'owner', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
      },
    ];

    const balanceOfParams = () =>
      new ContractFunctionParameters().addAddress(ADDR)._build('balanceOf');

    function withTxId(tx: ContractExecuteTransaction) {
      tx.setTransactionId(
        TransactionId.withValidStart(AccountId.fromString('0.0.2'), new Timestamp(1700000000, 0)),
      );
      return tx;
    }

    beforeEach(() => {
      getAllMock.mockResolvedValue([makeContract({ abi: JSON.stringify(resultAbi) })]);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test('shows the decoded return value once mirror node has indexed a personal transaction (after the retry delay)', async () => {
      lookupMock.mockResolvedValue({ callResult: `0x${'2a'.padStart(64, '0')}`, errorMessage: null });
      vi.useFakeTimers();
      const wrapper = await mountDetails(withTxId(makeTx({ params: balanceOfParams() })));
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(byId(wrapper, 'result').text()).toBe('uint256 = 42');
      expect(lookupMock).toHaveBeenCalledWith('0.0.2-1700000000-0', 'https://mirror.example');
    });

    test('shows the mirror-node-decoded revert reason instead of a result', async () => {
      lookupMock.mockResolvedValue({ callResult: '0x', errorMessage: 'ERC20: insufficient balance' });
      vi.useFakeTimers();
      const wrapper = await mountDetails(withTxId(makeTx({ params: balanceOfParams() })));
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(byId(wrapper, 'result-error').text()).toBe('ERC20: insufficient balance');
      expect(byId(wrapper, 'result').exists()).toBe(false);
    });

    test('shows nothing when there is no return data yet', async () => {
      lookupMock.mockResolvedValue({ callResult: '0x', errorMessage: null });
      vi.useFakeTimers();
      const wrapper = await mountDetails(withTxId(makeTx({ params: balanceOfParams() })));
      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();
      expect(wrapper.text()).not.toContain('Result');
    });

    test('skips the lookup for an organization transaction still pending execution', async () => {
      const org = { status: TransactionStatus.WAITING_FOR_SIGNATURES } as unknown as ITransactionFull;
      const wrapper = await mountDetails(withTxId(makeTx({ params: balanceOfParams() })), org);
      expect(lookupMock).not.toHaveBeenCalled();
      expect(wrapper.text()).not.toContain('Result');
    });

    test('fetches immediately (no retry delay) for an already-executed organization transaction', async () => {
      lookupMock.mockResolvedValue({ callResult: `0x${'2a'.padStart(64, '0')}`, errorMessage: null });
      const org = { status: TransactionStatus.EXECUTED } as unknown as ITransactionFull;
      const wrapper = await mountDetails(withTxId(makeTx({ params: balanceOfParams() })), org);
      expect(lookupMock).toHaveBeenCalled();
      expect(byId(wrapper, 'result').text()).toBe('uint256 = 42');
    });
  });
});
