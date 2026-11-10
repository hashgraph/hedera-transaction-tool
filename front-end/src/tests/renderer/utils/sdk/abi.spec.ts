// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  getAbiFunctions,
  getRoleGetterCandidates,
  isCallableAbiFunction,
  isSupportedAbiParameter,
  normalizeAbiInput,
  parseAbiJson,
  parseContractArtifact,
  parseStandardJsonSources,
  parseStoredAbi,
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

describe('parseStoredAbi', () => {
  test('parses a stored ABI JSON string', () => {
    expect(parseStoredAbi('[{"type":"function","name":"x"}]')).toEqual([
      { type: 'function', name: 'x' },
    ]);
  });

  test.each([null, undefined, ''])('returns [] for %j', value => {
    expect(parseStoredAbi(value)).toEqual([]);
  });

  test('returns [] for invalid JSON rather than throwing', () => {
    expect(parseStoredAbi('{not json')).toEqual([]);
  });
});

describe('parseStandardJsonSources', () => {
  test('extracts inline source content keyed by path', () => {
    const result = parseStandardJsonSources(
      JSON.stringify({
        language: 'Solidity',
        sources: { 'WorldClock.sol': { content: 'contract WorldClock {}' } },
      }),
    );

    expect(result.sources).toEqual([
      { path: 'WorldClock.sol', content: 'contract WorldClock {}' },
    ]);
    expect(result.contractNameHint).toBeNull();
  });

  test('picks up the contract name hint from settings.compilationTarget', () => {
    const result = parseStandardJsonSources(
      JSON.stringify({
        language: 'Solidity',
        sources: { 'WorldClock.sol': { content: 'contract WorldClock {}' } },
        settings: { compilationTarget: { 'WorldClock.sol': 'WorldClock' } },
      }),
    );

    expect(result.contractNameHint).toBe('WorldClock');
  });

  test('skips sources with no inline content (urls-only references)', () => {
    const result = parseStandardJsonSources(
      JSON.stringify({
        sources: {
          'Imported.sol': { urls: ['bzz-raw://...'] },
          'Main.sol': { content: 'contract Main {}' },
        },
      }),
    );

    expect(result.sources).toEqual([{ path: 'Main.sol', content: 'contract Main {}' }]);
  });

  test('throws on invalid JSON', () => {
    expect(() => parseStandardJsonSources('{nope')).toThrow('File is not valid JSON');
  });

  test('throws when there is no sources field', () => {
    expect(() => parseStandardJsonSources('{"abi":[]}')).toThrow('no inline source');
  });

  test('throws when no source has inline content', () => {
    expect(() =>
      parseStandardJsonSources(JSON.stringify({ sources: { 'A.sol': { urls: [] } } })),
    ).toThrow('no inline source');
  });
});

describe('parseContractArtifact', () => {
  test('finds an ABI in a plain array, with no source', () => {
    const result = parseContractArtifact(JSON.stringify([fn('foo')]));
    expect(result.abi).toEqual([fn('foo')]);
    expect(result.sources).toEqual([]);
  });

  test('finds inline source in a Standard JSON Input file, with no ABI', () => {
    const result = parseContractArtifact(
      JSON.stringify({ sources: { 'A.sol': { content: 'contract A {}' } } }),
    );
    expect(result.abi).toBeNull();
    expect(result.sources).toEqual([{ path: 'A.sol', content: 'contract A {}' }]);
  });

  test('throws on invalid JSON', () => {
    expect(() => parseContractArtifact('{nope')).toThrow('File is not valid JSON');
  });

  test('throws when the file has neither an ABI nor inline source', () => {
    expect(() => parseContractArtifact('{"foo":1}')).toThrow(
      'Could not find an ABI or source in this file',
    );
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

describe('isCallableAbiFunction', () => {
  test('true when every input is encodable (including zero inputs)', () => {
    expect(isCallableAbiFunction(fn('a'))).toBe(true);
    expect(isCallableAbiFunction(fn('a', ['address', 'uint256', 'string', 'bytes']))).toBe(true);
  });

  test('false when any input is a tuple or unsupported type', () => {
    expect(isCallableAbiFunction(fn('a', ['address', 'tuple']))).toBe(false);
  });

  // Unlike isSupportedAbiParameter (used for selector-based matching/decoding, which can still
  // identify a call with array params), arrays aren't encodable - encodeContractFunctionParams
  // throws on them (see contractFunctionParams.ts), so they must not be offered as callable.
  test('false when any input is an array, even though isSupportedAbiParameter allows it', () => {
    expect(isSupportedAbiParameter({ name: 'x', type: 'uint256[]' })).toBe(true);
    expect(isCallableAbiFunction(fn('a', ['uint256[]']))).toBe(false);
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
