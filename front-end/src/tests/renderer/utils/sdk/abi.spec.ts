// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  getAbiConstructor,
  getAbiFunctions,
  getRoleGetterCandidates,
  isCallableAbiFunction,
  isConstructorCallable,
  isSupportedAbiParameter,
  normalizeAbiInput,
  parseAbiJson,
  parseContractArtifact,
  parseStandardJsonSources,
  parseStoredAbi,
  type AbiConstructorItem,
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

  test('returns [] for valid JSON that is not an array, rather than passing it through', () => {
    expect(parseStoredAbi('{"foo":1}')).toEqual([]);
    expect(parseStoredAbi('"just a string"')).toEqual([]);
    expect(parseStoredAbi('42')).toEqual([]);
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
  test('finds an ABI in a plain array, with no source or bytecode', () => {
    const result = parseContractArtifact(JSON.stringify([fn('foo')]));
    expect(result.abi).toEqual([fn('foo')]);
    expect(result.sources).toEqual([]);
    expect(result.bytecode).toBeNull();
  });

  test('finds inline source in a Standard JSON Input file, with no ABI or bytecode', () => {
    const result = parseContractArtifact(
      JSON.stringify({ sources: { 'A.sol': { content: 'contract A {}' } } }),
    );
    expect(result.abi).toBeNull();
    expect(result.sources).toEqual([{ path: 'A.sol', content: 'contract A {}' }]);
    expect(result.bytecode).toBeNull();
  });

  test('finds Hardhat-style bytecode (a plain hex string)', () => {
    const result = parseContractArtifact(
      JSON.stringify({ abi: [fn('foo')], bytecode: '0x6080604052', deployedBytecode: '0xaabb' }),
    );
    expect(result.bytecode).toBe('0x6080604052');
  });

  test('finds Foundry-style bytecode (nested under bytecode.object)', () => {
    const result = parseContractArtifact(
      JSON.stringify({
        abi: [fn('foo')],
        bytecode: { object: '0x6080604052', sourceMap: '1:2:3' },
        deployedBytecode: { object: '0xaabb' },
      }),
    );
    expect(result.bytecode).toBe('0x6080604052');
  });

  test('treats empty bytecode ("0x", e.g. an interface) as absent', () => {
    const result = parseContractArtifact(JSON.stringify({ abi: [fn('foo')], bytecode: '0x' }));
    expect(result.bytecode).toBeNull();

    const nested = parseContractArtifact(
      JSON.stringify({ abi: [fn('foo')], bytecode: { object: '0x' } }),
    );
    expect(nested.bytecode).toBeNull();
  });

  test('never reads deployedBytecode as a fallback for bytecode', () => {
    const result = parseContractArtifact(
      JSON.stringify({ abi: [fn('foo')], deployedBytecode: '0x6080604052' }),
    );
    expect(result.bytecode).toBeNull();
  });

  test('throws on invalid JSON', () => {
    expect(() => parseContractArtifact('{nope')).toThrow('File is not valid JSON');
  });

  test('throws when the file has neither an ABI, bytecode, nor inline source', () => {
    expect(() => parseContractArtifact('{"foo":1}')).toThrow(
      'Could not find an ABI, bytecode, or source in this file',
    );
  });

  test('does not throw when only bytecode is present', () => {
    const result = parseContractArtifact(JSON.stringify({ bytecode: '0x6080604052' }));
    expect(result.abi).toBeNull();
    expect(result.bytecode).toBe('0x6080604052');
  });

  test('finds ABI + bytecode in a single-contract solc --standard-json output', () => {
    const result = parseContractArtifact(
      JSON.stringify({
        contracts: {
          'WorldClock.sol': {
            WorldClock: {
              abi: [fn('foo')],
              evm: { bytecode: { object: '0x6080604052', sourceMap: '1:2:3' } },
            },
          },
        },
        sources: { 'WorldClock.sol': { id: 0 } },
      }),
    );
    expect(result.abi).toEqual([fn('foo')]);
    expect(result.bytecode).toBe('0x6080604052');
  });

  test('does not guess which contract to use when solc --standard-json output has more than one', () => {
    const multiContract = JSON.stringify({
      contracts: {
        'WorldClock.sol': {
          WorldClock: { abi: [fn('foo')], evm: { bytecode: { object: '0x6080604052' } } },
          Imported: { abi: [fn('bar')], evm: { bytecode: { object: '0xaabbcc' } } },
        },
      },
    });
    // Nothing else in this file to fall back to (no top-level abi/bytecode, no inline source), so
    // this throws like any other file with nothing usable - it does not guess and return a result.
    expect(() => parseContractArtifact(multiContract)).toThrow(
      'Could not find an ABI, bytecode, or source in this file',
    );

    // With inline source also present, the ambiguous ABI/bytecode still come back null, but the
    // source is usable on its own, so this does not throw.
    const withSource = JSON.stringify({
      contracts: {
        'WorldClock.sol': {
          WorldClock: { abi: [fn('foo')], evm: { bytecode: { object: '0x6080604052' } } },
          Imported: { abi: [fn('bar')], evm: { bytecode: { object: '0xaabbcc' } } },
        },
      },
      sources: { 'WorldClock.sol': { content: 'contract WorldClock {}' } },
    });
    const result = parseContractArtifact(withSource);
    expect(result.abi).toBeNull();
    expect(result.bytecode).toBeNull();
    expect(result.sources).toEqual([{ path: 'WorldClock.sol', content: 'contract WorldClock {}' }]);
  });

  test('ignores an empty contracts map rather than treating it as found', () => {
    expect(() => parseContractArtifact(JSON.stringify({ contracts: {} }))).toThrow(
      'Could not find an ABI, bytecode, or source in this file',
    );
  });

  test('does not fall back to solc-output extraction when a top-level ABI/bytecode is already found', () => {
    const result = parseContractArtifact(
      JSON.stringify({
        abi: [fn('foo')],
        bytecode: '0x6080604052',
        contracts: {
          'Other.sol': { Other: { abi: [fn('bar')], evm: { bytecode: { object: '0xaabbcc' } } } },
        },
      }),
    );
    expect(result.abi).toEqual([fn('foo')]);
    expect(result.bytecode).toBe('0x6080604052');
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

describe('getAbiConstructor', () => {
  const ctor = (inputTypes: string[] = []): AbiConstructorItem => ({
    type: 'constructor',
    inputs: inputTypes.map((type, i) => ({ name: `a${i}`, type })),
  });

  test('finds the constructor entry', () => {
    const abi: AbiItem[] = [fn('a'), ctor(['address', 'uint256']), fn('b')];
    expect(getAbiConstructor(abi)).toEqual(ctor(['address', 'uint256']));
  });

  test('returns null when the ABI has no constructor entry', () => {
    expect(getAbiConstructor([fn('a')])).toBeNull();
  });
});

describe('isConstructorCallable', () => {
  const ctor = (inputTypes: string[] = []): AbiConstructorItem => ({
    type: 'constructor',
    inputs: inputTypes.map((type, i) => ({ name: `a${i}`, type })),
  });

  test('true when every input is encodable (including zero inputs)', () => {
    expect(isConstructorCallable(ctor())).toBe(true);
    expect(isConstructorCallable(ctor(['address', 'uint256', 'string', 'bytes']))).toBe(true);
  });

  test('false when any input is a tuple, array, or unsupported type', () => {
    expect(isConstructorCallable(ctor(['address', 'tuple']))).toBe(false);
    expect(isConstructorCallable(ctor(['uint256[]']))).toBe(false);
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
