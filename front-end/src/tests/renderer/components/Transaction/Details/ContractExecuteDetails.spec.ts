// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import {
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractId,
  Hbar,
  TransferTransaction,
} from '@hiero-ledger/sdk';

import ContractExecuteDetails from '@renderer/components/Transaction/Details/ContractExecuteDetails.vue';

const userState = reactive<{ personal: unknown }>({ personal: null });
const networkState = reactive({ network: 'testnet' });

vi.mock('@renderer/stores/storeUser', () => ({ default: () => userState }));
vi.mock('@renderer/stores/storeNetwork', () => ({ default: () => networkState }));

const getAllMock = vi.fn();
vi.mock('@renderer/services/smartContractsService', () => ({
  getAll: (...args: unknown[]) => getAllMock(...args),
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

function makeTx(opts: { id?: ContractId; gas?: number; payable?: Hbar; params?: Uint8Array } = {}) {
  const tx = new ContractExecuteTransaction();
  tx.setContractId(opts.id ?? ContractId.fromString('0.0.1001'));
  if (opts.gas !== undefined) tx.setGas(opts.gas);
  if (opts.payable) tx.setPayableAmount(opts.payable);
  if (opts.params) tx.setFunctionParameters(opts.params);
  return tx;
}

async function mountDetails(transaction: unknown) {
  const wrapper = mount(ContractExecuteDetails, {
    props: { transaction: transaction as never, organizationTransaction: null },
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
  });

  test('renders nothing for a non ContractExecute transaction', async () => {
    const wrapper = await mountDetails(new TransferTransaction());
    expect(wrapper.find('.row').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('Contract ID');
  });

  test('shows contract id, gas and payable amount', async () => {
    const wrapper = await mountDetails(makeTx({ gas: 250000, payable: new Hbar(5) }));
    expect(byId(wrapper, 'contract-id').text()).toBe('0.0.1001');
    expect(byId(wrapper, 'gas').text()).toBe('250000');
    expect(byId(wrapper, 'payable-amount').text()).toContain('5');
  });

  test('shows None / 0 and hides payable amount when unset', async () => {
    const wrapper = await mountDetails(new ContractExecuteTransaction());
    expect(byId(wrapper, 'contract-id').text()).toBe('None');
    expect(byId(wrapper, 'gas').text()).toBe('0');
    expect(byId(wrapper, 'payable-amount').exists()).toBe(false);
    // no contract id -> nothing to match, no calldata -> no ABI message
    expect(byId(wrapper, 'no-abi').exists()).toBe(true);
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

  test('identifies the function but shows raw calldata when args are not decodable', async () => {
    const params = nameParams();
    const wrapper = await mountDetails(makeTx({ params }));
    expect(byId(wrapper, 'function').text()).toBe('setName(...)');
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

    test('a different contract with a different evm address does not match', async () => {
      getAllMock.mockResolvedValue([
        makeContract({ contract_id: '0.0.2002', evm_address: evmOf('0.0.3003') }),
        makeContract({ contract_id: null, evm_address: null }),
      ]);
      const wrapper = await mountDetails(makeTx({ params: mintParams() }));
      expect(byId(wrapper, 'no-abi').exists()).toBe(true);
    });
  });
});
