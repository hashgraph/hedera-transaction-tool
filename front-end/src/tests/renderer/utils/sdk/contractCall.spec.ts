// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ContractId } from '@hiero-ledger/sdk';

const { callContract } = vi.hoisted(() => ({ callContract: vi.fn() }));
vi.mock('@renderer/services/mirrorNodeDataService', () => ({ callContract }));

import {
  buildZeroArgCallData,
  contractIdToReference,
  decodeBytes32Result,
  findMatchingSavedContract,
  parseContractReference,
  resolveBytes32Getter,
  simulateContractCall,
  toCallAddress,
} from '@renderer/utils/sdk/contractCall';

const MIRROR = 'https://mirror.example';
const EVM = '00000000000000000000000000000000000004d2'; // 0.0.1234
const WORD = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0');
const ROLE = '0x' + 'aa'.repeat(32);

beforeEach(() => callContract.mockReset());

describe('toCallAddress', () => {
  test('prefers the evm address, adding 0x when missing', () => {
    expect(toCallAddress({ evmAddress: EVM, contractId: '0.0.1' })).toBe(`0x${EVM}`);
    expect(toCallAddress({ evmAddress: `0x${EVM}` })).toBe(`0x${EVM}`);
  });

  test('derives the long-zero address from the contract id', () => {
    expect(toCallAddress({ contractId: '0.0.1234' })).toBe(`0x${EVM}`);
  });

  test('throws with neither', () => {
    expect(() => toCallAddress({})).toThrow('neither a Contract ID nor an EVM address');
    expect(() => toCallAddress({ contractId: null, evmAddress: null })).toThrow();
  });
});

describe('parseContractReference', () => {
  test('parses shard.realm.num (trimmed)', () => {
    expect(parseContractReference(' 0.0.1234 ')?.toString()).toBe('0.0.1234');
  });

  test('parses an EVM address with or without 0x', () => {
    const a = parseContractReference(`0x${EVM}`);
    const b = parseContractReference(EVM);
    expect(a).toBeInstanceOf(ContractId);
    expect(a?.toEvmAddress()).toBe(EVM);
    expect(b?.toEvmAddress()).toBe(EVM);
  });

  test('returns null for garbage', () => {
    expect(parseContractReference('')).toBeNull();
    expect(parseContractReference('abc')).toBeNull();
    expect(parseContractReference('0x1234')).toBeNull();
    expect(parseContractReference('0.0')).toBeNull();
  });

  test('returns null when the SDK rejects a well-formed id', () => {
    const spy = vi.spyOn(ContractId, 'fromString').mockImplementationOnce(() => {
      throw new Error('bad');
    });
    expect(parseContractReference('0.0.5')).toBeNull();
    spy.mockRestore();

    const spy2 = vi.spyOn(ContractId, 'fromEvmAddress').mockImplementationOnce(() => {
      throw new Error('bad');
    });
    expect(parseContractReference(EVM)).toBeNull();
    spy2.mockRestore();
  });
});

describe('contractIdToReference', () => {
  // Not long-zero (i.e. not derived from a shard.realm.num) - a CREATE2-style address.
  const NON_LONG_ZERO = 'abcdef1234567890abcdef1234567890abcdef12';

  test('returns the plain "0.0.X" string for a non-EVM-backed id', () => {
    expect(contractIdToReference(ContractId.fromString('0.0.1234'))).toBe('0.0.1234');
  });

  test('returns the "0x..." form for a genuine (non-long-zero) EVM-backed id, not the SDK\'s raw "shard.realm.<hex>" toString()', () => {
    const id = ContractId.fromEvmAddress(0, 0, `0x${NON_LONG_ZERO}`);
    // this is the string parseContractReference (and anything built on it) can't read back
    expect(id.toString()).toBe(`0.0.${NON_LONG_ZERO}`);
    expect(contractIdToReference(id)).toBe(`0x${NON_LONG_ZERO}`);
  });

  test('falls back to "0.0.X" for a long-zero EVM address (SDK resolves it to a real entity num, evmAddress stays unset)', () => {
    const id = ContractId.fromEvmAddress(0, 0, `0x${EVM}`);
    expect(id.evmAddress).toBeNull();
    expect(contractIdToReference(id)).toBe('0.0.1234');
  });
});

describe('findMatchingSavedContract', () => {
  const evmOf = (id: string) => ContractId.fromString(id).toEvmAddress();

  test('matches by an equivalent but textually different "0.0.X" id (same EVM address)', () => {
    const contracts = [{ contract_id: '0.0.01001', evm_address: null }];
    expect(findMatchingSavedContract(contracts, '0.0.1001')).toBe(contracts[0]);
  });

  test.each([
    ['with 0x prefix', (a: string) => `0x${a}`],
    ['without 0x prefix', (a: string) => a],
    ['uppercase', (a: string) => `0x${a.toUpperCase()}`],
  ])('matches a saved evm address by reference %s', (_n, fmt) => {
    const contracts = [{ contract_id: null, evm_address: fmt(evmOf('0.0.1001')) }];
    expect(findMatchingSavedContract(contracts, '0.0.1001')).toBe(contracts[0]);
  });

  test('matches a saved "0.0.X" id when the reference is an EVM address', () => {
    const contracts = [{ contract_id: '0.0.1001', evm_address: null }];
    expect(findMatchingSavedContract(contracts, `0x${evmOf('0.0.1001')}`)).toBe(contracts[0]);
  });

  test('an unparseable saved contract id falls through to the evm address check', () => {
    const contracts = [{ contract_id: 'not-an-id', evm_address: evmOf('0.0.1001') }];
    expect(findMatchingSavedContract(contracts, '0.0.1001')).toBe(contracts[0]);
  });

  test('returns null when nothing matches, or the reference is unparseable', () => {
    const contracts = [
      { contract_id: '0.0.2002', evm_address: evmOf('0.0.3003') },
      { contract_id: null, evm_address: null },
    ];
    expect(findMatchingSavedContract(contracts, '0.0.1001')).toBeNull();
    expect(findMatchingSavedContract(contracts, 'garbage')).toBeNull();
  });
});

describe('buildZeroArgCallData', () => {
  test('is 0x + the 4-byte selector of name()', () => {
    // keccak256("name()")[0..4] = 06fdde03
    expect(buildZeroArgCallData('name')).toBe('0x06fdde03');
  });
});

describe('decodeBytes32Result', () => {
  test('accepts a 32-byte word with or without 0x', () => {
    expect(decodeBytes32Result(ROLE)).toBe(ROLE);
    expect(decodeBytes32Result(ROLE.slice(2))).toBe(ROLE);
  });

  test('null for any other length', () => {
    expect(decodeBytes32Result('0x')).toBeNull();
    expect(decodeBytes32Result('0x1234')).toBeNull();
    expect(decodeBytes32Result(ROLE + '00')).toBeNull();
  });
});

describe('resolveBytes32Getter', () => {
  test('calls the contract with the getter selector and decodes the word', async () => {
    callContract.mockResolvedValue({ success: true, result: ROLE });
    const value = await resolveBytes32Getter({ contractId: '0.0.1234' }, 'name', MIRROR);
    expect(value).toBe(ROLE);
    expect(callContract).toHaveBeenCalledWith({ to: `0x${EVM}`, data: '0x06fdde03' }, MIRROR);
  });

  test('null on failure, empty result, or malformed result', async () => {
    callContract.mockResolvedValueOnce({ success: false, errorMessage: 'x' });
    expect(await resolveBytes32Getter({ contractId: '0.0.1234' }, 'name', MIRROR)).toBeNull();
    callContract.mockResolvedValueOnce({ success: true });
    expect(await resolveBytes32Getter({ contractId: '0.0.1234' }, 'name', MIRROR)).toBeNull();
    callContract.mockResolvedValueOnce({ success: true, result: '0x12' });
    expect(await resolveBytes32Getter({ contractId: '0.0.1234' }, 'name', MIRROR)).toBeNull();
  });
});

describe('simulateContractCall', () => {
  const contract = { contractId: '0.0.1234' };
  const args = [{ name: 'amount', type: 'uint256', value: '5' }];

  test('sends the encoded call with gas/value/from and reports pass on success', async () => {
    callContract.mockResolvedValue({ success: true, result: '0x' + WORD('01') });
    const result = await simulateContractCall(
      contract,
      'transfer',
      args,
      { gas: 100_000, valueTinybars: 50, from: '0.0.1001' },
      MIRROR,
    );
    expect(result).toEqual({ status: 'pass' });
    const [request, link] = callContract.mock.calls[0];
    expect(link).toBe(MIRROR);
    expect(request).toEqual({
      to: `0x${EVM}`,
      data: expect.stringMatching(/^0x[0-9a-f]+$/),
      from: '0.0.1001',
      gas: 100_000,
      value: 50,
    });
  });

  test('reports fail with the mirror node error message on revert', async () => {
    callContract.mockResolvedValue({ success: false, errorMessage: 'CONTRACT_REVERT_EXECUTED' });
    const result = await simulateContractCall(contract, 'transfer', args, {}, MIRROR);
    expect(result).toEqual({ status: 'fail', errorMessage: 'CONTRACT_REVERT_EXECUTED' });
  });

  test('unknown (never fail) on thrown errors or a bad contract reference', async () => {
    callContract.mockRejectedValueOnce(new Error('network down'));
    expect(await simulateContractCall(contract, 'transfer', args, {}, MIRROR)).toEqual({
      status: 'unknown',
    });
    expect(await simulateContractCall({}, 'transfer', args, {}, MIRROR)).toEqual({
      status: 'unknown',
    });
  });
});
