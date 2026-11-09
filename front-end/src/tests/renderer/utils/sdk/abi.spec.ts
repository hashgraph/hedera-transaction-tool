// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  getAbiFunctions,
  getRoleGetterCandidates,
  isFullyDecodableAbiFunction,
  isStaticAbiParameter,
  isSupportedAbiFunction,
  isSupportedAbiParameter,
  normalizeAbiInput,
  parseAbiJson,
  type AbiFunctionItem,
  type AbiItem,
} from '@renderer/utils/sdk/abi';

const fn = (
  name: string,
  inputTypes: string[] = [],
  extra: Partial<AbiFunctionItem> = {},
): AbiFunctionItem => ({
  type: 'function',
  name,
  inputs: inputTypes.map((type, i) => ({ name: `a${i}`, type })),
  outputs: [],
  ...extra,
});

describe('normalizeAbiInput', () => {
  test('returns a top-level array as-is', () => {
    const abi = [fn('foo')];
    expect(normalizeAbiInput(abi)).toBe(abi);
  });

  test('extracts the abi field from Hardhat/Foundry style artifacts', () => {
    const abi = [fn('foo')];
    expect(normalizeAbiInput({ abi, bytecode: '0x' })).toBe(abi);
  });

  test.each([null, undefined, 'str', 5, {}, { abi: 'nope' }])('returns null for %j', raw => {
    expect(normalizeAbiInput(raw)).toBeNull();
  });
});

describe('parseAbiJson', () => {
  test('parses an array and an artifact object', () => {
    expect(parseAbiJson('[{"type":"function","name":"x"}]')).toHaveLength(1);
    expect(parseAbiJson('{"abi":[{"type":"event"}]}')).toHaveLength(1);
  });

  test('throws on invalid JSON', () => {
    expect(() => parseAbiJson('{nope')).toThrow('File is not valid JSON');
  });

  test('throws when no ABI can be found', () => {
    expect(() => parseAbiJson('{"foo":1}')).toThrow('Could not find an ABI');
  });
});

describe('getAbiFunctions', () => {
  test('keeps only function items', () => {
    const abi: AbiItem[] = [
      fn('a'),
      { type: 'event', name: 'E' },
      { type: 'constructor' },
      fn('b'),
    ];
    expect(getAbiFunctions(abi).map(f => f.name)).toEqual(['a', 'b']);
  });
});

describe('isSupportedAbiParameter', () => {
  test.each([
    'uint',
    'uint8',
    'uint256',
    'int',
    'int128',
    'address',
    'bool',
    'bytes32',
    'string',
    'uint256[]',
    'bytes32[]',
  ])('supports %s', type => {
    expect(isSupportedAbiParameter({ name: 'x', type })).toBe(true);
  });

  test.each([
    'tuple',
    'tuple[]',
    'bytes1',
    'bytes3',
    'bytes31',
    'address[3]',
    'bytes32[2]',
    'uint7',
    'uint512',
    'function',
    'mapping',
  ])('rejects %s', type => {
    expect(isSupportedAbiParameter({ name: 'x', type })).toBe(false);
  });
});

describe('isSupportedAbiParameter - dynamic bytes', () => {
  test.each(['bytes', 'bytes32', 'bytes[]'])('supports %s', type => {
    expect(isSupportedAbiParameter({ name: 'x', type })).toBe(true);
  });
});

describe('isSupportedAbiFunction', () => {
  test('true when every input is supported (including zero inputs)', () => {
    expect(isSupportedAbiFunction(fn('a'))).toBe(true);
    expect(isSupportedAbiFunction(fn('a', ['address', 'uint256[]']))).toBe(true);
  });

  test('false when any input is unsupported', () => {
    expect(isSupportedAbiFunction(fn('a', ['address', 'tuple']))).toBe(false);
  });
});

describe('isStaticAbiParameter / isFullyDecodableAbiFunction', () => {
  test.each(['uint256', 'int8', 'address', 'bool', 'bytes32'])('%s is static', type => {
    expect(isStaticAbiParameter({ name: 'x', type })).toBe(true);
  });

  test.each(['uint256[]', 'address[2]', 'string', 'bytes', 'tuple'])('%s is not static', type => {
    expect(isStaticAbiParameter({ name: 'x', type })).toBe(false);
  });

  test('function is decodable only if all inputs are static', () => {
    expect(isFullyDecodableAbiFunction(fn('a', ['address', 'uint256']))).toBe(true);
    expect(isFullyDecodableAbiFunction(fn('a'))).toBe(true);
    expect(isFullyDecodableAbiFunction(fn('a', ['address', 'string']))).toBe(false);
  });
});

describe('getRoleGetterCandidates', () => {
  const b32 = [{ name: '', type: 'bytes32' }];

  test('matches zero-arg view/pure getters returning a single bytes32', () => {
    const abi: AbiItem[] = [
      fn('ADMIN_ROLE', [], { stateMutability: 'view', outputs: b32 }),
      fn('PAUSER_ROLE', [], { stateMutability: 'pure', outputs: b32 }),
    ];
    expect(getRoleGetterCandidates(abi).map(f => f.name)).toEqual(['ADMIN_ROLE', 'PAUSER_ROLE']);
  });

  test('excludes functions with args, non-view mutability, or other outputs', () => {
    const abi: AbiItem[] = [
      fn('withArg', ['address'], { stateMutability: 'view', outputs: b32 }),
      fn('nonpayable', [], { stateMutability: 'nonpayable', outputs: b32 }),
      fn('noMutability', [], { outputs: b32 }),
      fn('noOutput', [], { stateMutability: 'view' }),
      fn('twoOutputs', [], { stateMutability: 'view', outputs: [...b32, ...b32] }),
      fn('wrongType', [], { stateMutability: 'view', outputs: [{ name: '', type: 'uint256' }] }),
      { type: 'event', name: 'E' },
    ];
    expect(getRoleGetterCandidates(abi)).toEqual([]);
  });
});
