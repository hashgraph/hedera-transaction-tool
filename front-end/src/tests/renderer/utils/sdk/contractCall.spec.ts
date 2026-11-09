// @vitest-environment node
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ContractId } from '@hiero-ledger/sdk';

const { callContract } = vi.hoisted(() => ({ callContract: vi.fn() }));
vi.mock('@renderer/services/mirrorNodeDataService', () => ({ callContract }));

import {
  buildZeroArgCallData,
  checkAccountHasRole,
  decodeBytes32Result,
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

describe('checkAccountHasRole', () => {
  const contract = { contractId: '0.0.1234' };

  test('sends hasRole(bytes32,address) calldata for the role and account', async () => {
    callContract.mockResolvedValue({ success: true, result: '0x' + WORD('01') });
    await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR);
    const [request, link] = callContract.mock.calls[0];
    expect(link).toBe(MIRROR);
    expect(request.to).toBe(`0x${EVM}`);
    expect(request.data).toBe('0x91d14854' + ROLE.slice(2) + WORD('03e9'));
  });

  test('pass when result is non-zero (with or without 0x)', async () => {
    callContract.mockResolvedValueOnce({ success: true, result: '0x' + WORD('01') });
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('pass');
    callContract.mockResolvedValueOnce({ success: true, result: WORD('01') });
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('pass');
  });

  test('fail when result is zero', async () => {
    callContract.mockResolvedValue({ success: true, result: '0x' + WORD('00') });
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('fail');
  });

  test('unknown when the simulation failed or returned nothing', async () => {
    callContract.mockResolvedValueOnce({ success: false, errorMessage: 'revert' });
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('unknown');
    callContract.mockResolvedValueOnce({ success: true });
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('unknown');
  });

  test('unknown (never fail) on thrown errors, bad account id, or bad contract', async () => {
    callContract.mockRejectedValueOnce(new Error('network down'));
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('unknown');
    expect(await checkAccountHasRole(contract, ROLE, 'not-an-account', MIRROR)).toBe('unknown');
    expect(await checkAccountHasRole({}, ROLE, '0.0.1001', MIRROR)).toBe('unknown');
    expect(await checkAccountHasRole(contract, '0x1234', '0.0.1001', MIRROR)).toBe('unknown');
  });

  test('empty result "0x" is fail', async () => {
    callContract.mockResolvedValue({ success: true, result: '0x' });
    // `!result` is false for "0x" (non-empty string); hex.length === 0 -> fail
    expect(await checkAccountHasRole(contract, ROLE, '0.0.1001', MIRROR)).toBe('fail');
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
