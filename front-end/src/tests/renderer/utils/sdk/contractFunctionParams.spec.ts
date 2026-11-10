// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { ContractFunctionParameters } from '@hiero-ledger/sdk';

import { hexToUint8Array, uint8ToHex } from '@renderer/utils';
import type { AbiFunctionItem, AbiItem } from '@renderer/utils/sdk/abi';
import {
  areContractCallArgsEncodable,
  buildFunctionCallData,
  decodeContractCall,
  encodeContractFunctionParams,
  isAllowedFunctionArgKey,
  sanitizeFunctionArgInput,
  validateFunctionArgValue,
  type ContractCallArgument,
} from '@renderer/utils/sdk/contractFunctionParams';

const ADDR = '0x00000000000000000000000000000000000004d2';
const WORD = (hex: string) => hex.replace(/^0x/, '').padStart(64, '0');

const fn = (name: string, inputs: [string, string][]): AbiFunctionItem => ({
  type: 'function',
  name,
  inputs: inputs.map(([n, type]) => ({ name: n, type })),
  outputs: [],
});

const encodeCall = (name: string, args: ContractCallArgument[]) =>
  buildFunctionCallData(name, args).slice(2);

describe('encodeContractFunctionParams', () => {
  test('encodes each static type into a 32-byte word', () => {
    const params = encodeContractFunctionParams([
      { name: 'a', type: 'address', value: ADDR },
      { name: 'n', type: 'uint256', value: '255' },
      { name: 'b', type: 'bool', value: 'true' },
      { name: 'f', type: 'bool', value: 'false' },
      { name: 'r', type: 'bytes32', value: '0x' + 'ab'.repeat(32) },
      { name: 'i', type: 'int256', value: '-1' },
    ]);
    const hex = uint8ToHex(params._build());
    expect(hex).toBe(
      WORD(ADDR) +
        WORD('ff') +
        WORD('01') +
        WORD('00') +
        'ab'.repeat(32) +
        'f'.repeat(64),
    );
  });

  test('treats bare uint/int as 256-bit', () => {
    const hex = uint8ToHex(
      encodeContractFunctionParams([
        { name: 'u', type: 'uint', value: '7' },
        { name: 'i', type: 'int', value: '-2' },
      ])._build(),
    );
    expect(hex).toBe(WORD('07') + 'f'.repeat(63) + 'e');
  });

  test('encodes string and dynamic bytes (offset + length + data)', () => {
    const hexStr = uint8ToHex(
      encodeContractFunctionParams([{ name: 's', type: 'string', value: 'hi' }])._build(),
    );
    expect(hexStr).toBe(WORD('20') + WORD('02') + '6869'.padEnd(64, '0'));

    const hexBytes = uint8ToHex(
      encodeContractFunctionParams([{ name: 'b', type: 'bytes', value: '0x0102' }])._build(),
    );
    expect(hexBytes).toBe(WORD('20') + WORD('02') + '0102'.padEnd(64, '0'));
  });

  test('rejects array types', () => {
    expect(() =>
      encodeContractFunctionParams([{ name: 'xs', type: 'uint256[]', value: '[]' }]),
    ).toThrow('Array parameters are not supported yet: xs (uint256[])');
    expect(() =>
      encodeContractFunctionParams([{ name: 'xs', type: 'address[2]', value: '' }]),
    ).toThrow('Array parameters');
  });

  test('rejects unknown types', () => {
    expect(() =>
      encodeContractFunctionParams([{ name: 'x', type: 'tuple', value: '' }]),
    ).toThrow('Unsupported parameter type: tuple');
  });

  test('returns empty params for no args', () => {
    expect(encodeContractFunctionParams([])._build().length).toBe(0);
  });
});

describe('areContractCallArgsEncodable', () => {
  test('true for complete args and for no args', () => {
    expect(areContractCallArgsEncodable([])).toBe(true);
    expect(areContractCallArgsEncodable([{ name: 'n', type: 'uint256', value: '5' }])).toBe(true);
  });

  test('false for empty/malformed values or unsupported types', () => {
    expect(areContractCallArgsEncodable([{ name: 'n', type: 'uint256', value: '' }])).toBe(false);
    expect(areContractCallArgsEncodable([{ name: 'a', type: 'address', value: '' }])).toBe(false);
    expect(areContractCallArgsEncodable([{ name: 'x', type: 'tuple', value: '' }])).toBe(false);
    expect(areContractCallArgsEncodable([{ name: 'x', type: 'uint256[]', value: '' }])).toBe(false);
  });
});

describe('buildFunctionCallData', () => {
  test('prefixes the known ERC-20 transfer selector (a9059cbb) to the encoded args', () => {
    const data = buildFunctionCallData('transfer', [
      { name: 'to', type: 'address', value: ADDR },
      { name: 'amount', type: 'uint256', value: '1' },
    ]);
    expect(data).toBe('0xa9059cbb' + WORD(ADDR) + WORD('01'));
  });

  test('hasRole(bytes32,address) selector is 91d14854', () => {
    expect(
      buildFunctionCallData('hasRole', [
        { name: 'role', type: 'bytes32', value: '0x' + '00'.repeat(32) },
        { name: 'account', type: 'address', value: ADDR },
      ]).startsWith('0x91d14854'),
    ).toBe(true);
  });
});

describe('decodeContractCall', () => {
  const transferFn = fn('transfer', [
    ['to', 'address'],
    ['amount', 'uint256'],
  ]);
  const abi: AbiItem[] = [
    { type: 'event', name: 'Transfer' },
    fn('balanceOf', [['owner', 'address']]),
    transferFn,
  ];

  test('round-trips address + uint256 args and picks the right function by selector', () => {
    const data = hexToUint8Array(
      encodeCall('transfer', [
        { name: 'to', type: 'address', value: ADDR },
        { name: 'amount', type: 'uint256', value: '123456789' },
      ]),
    );
    expect(decodeContractCall(abi, data)).toEqual({
      functionName: 'transfer',
      args: [
        { name: 'to', type: 'address', value: ADDR },
        { name: 'amount', type: 'uint256', value: '123456789' },
      ],
    });
  });

  test('round-trips bool, bytes32 and negative int', () => {
    const roundAbi = [
      fn('f', [
        ['b', 'bool'],
        ['bf', 'bool'],
        ['r', 'bytes32'],
        ['i', 'int256'],
        ['u', 'uint8'],
      ]),
    ];
    const root = '0x' + 'cd'.repeat(32);
    const data = hexToUint8Array(
      encodeCall('f', [
        { name: 'b', type: 'bool', value: 'true' },
        { name: 'bf', type: 'bool', value: 'false' },
        { name: 'r', type: 'bytes32', value: root },
        { name: 'i', type: 'int256', value: '-5' },
        { name: 'u', type: 'uint8', value: '200' },
      ]),
    );
    expect(decodeContractCall(roundAbi, data)?.args?.map(a => a.value)).toEqual([
      'true',
      'false',
      root,
      '-5',
      '200',
    ]);
  });

  test('positive int is not sign-adjusted', () => {
    const data = hexToUint8Array(encodeCall('g', [{ name: 'i', type: 'int256', value: '5' }]));
    expect(decodeContractCall([fn('g', [['i', 'int256']])], data)?.args?.[0].value).toBe('5');
  });

  test('zero-arg function decodes to empty args', () => {
    const data = hexToUint8Array(encodeCall('pause', []));
    expect(decodeContractCall([fn('pause', [])], data)).toEqual({ functionName: 'pause', args: [] });
  });

  test('round-trips a string arg (head/tail: offset + length + utf8 data)', () => {
    const data = hexToUint8Array(encodeCall('setGreeting', [{ name: 'g', type: 'string', value: 'Well Hello!' }]));
    expect(decodeContractCall([fn('setGreeting', [['g', 'string']])], data)).toEqual({
      functionName: 'setGreeting',
      args: [{ name: 'g', type: 'string', value: 'Well Hello!' }],
    });
  });

  test('round-trips a dynamic bytes arg (head/tail: offset + length + hex data)', () => {
    const data = hexToUint8Array(encodeCall('setBlob', [{ name: 'b', type: 'bytes', value: '0x0102ff' }]));
    expect(decodeContractCall([fn('setBlob', [['b', 'bytes']])], data)).toEqual({
      functionName: 'setBlob',
      args: [{ name: 'b', type: 'bytes', value: '0x0102ff' }],
    });
  });

  test('round-trips a mix of static and dynamic args, decoding head offsets in declaration order', () => {
    const data = hexToUint8Array(
      encodeCall('f', [
        { name: 'a', type: 'address', value: ADDR },
        { name: 's', type: 'string', value: 'hi' },
        { name: 'n', type: 'uint256', value: '7' },
      ]),
    );
    expect(
      decodeContractCall(
        [fn('f', [['a', 'address'], ['s', 'string'], ['n', 'uint256']])],
        data,
      )?.args,
    ).toEqual([
      { name: 'a', type: 'address', value: ADDR },
      { name: 's', type: 'string', value: 'hi' },
      { name: 'n', type: 'uint256', value: '7' },
    ]);
  });

  test('an empty string/bytes decodes to an empty value', () => {
    const stringData = hexToUint8Array(
      encodeCall('setGreeting', [{ name: 'g', type: 'string', value: '' }]),
    );
    expect(
      decodeContractCall([fn('setGreeting', [['g', 'string']])], stringData)?.args?.[0].value,
    ).toBe('');

    const bytesData = hexToUint8Array(encodeCall('setBlob', [{ name: 'b', type: 'bytes', value: '0x' }]));
    expect(decodeContractCall([fn('setBlob', [['b', 'bytes']])], bytesData)?.args?.[0].value).toBe(
      '0x',
    );
  });

  test('decodes a string longer than one 32-byte tail word', () => {
    const long = 'x'.repeat(75); // spans three 32-byte words of tail data
    const data = hexToUint8Array(encodeCall('setGreeting', [{ name: 'g', type: 'string', value: long }]));
    expect(decodeContractCall([fn('setGreeting', [['g', 'string']])], data)?.args?.[0].value).toBe(
      long,
    );
  });

  test('round-trips multiple dynamic args, each with its own independent tail offset', () => {
    const data = hexToUint8Array(
      encodeCall('f', [
        { name: 's1', type: 'string', value: 'hello' },
        { name: 'b', type: 'bytes', value: '0xdeadbeef' },
        { name: 's2', type: 'string', value: 'world' },
      ]),
    );
    expect(
      decodeContractCall([fn('f', [['s1', 'string'], ['b', 'bytes'], ['s2', 'string']])], data)
        ?.args,
    ).toEqual([
      { name: 's1', type: 'string', value: 'hello' },
      { name: 'b', type: 'bytes', value: '0xdeadbeef' },
      { name: 's2', type: 'string', value: 'world' },
    ]);
  });

  test('round-trips every supported non-array type in a single call', () => {
    const root = '0x' + 'cd'.repeat(32);
    const callArgs: ContractCallArgument[] = [
      { name: 'addr', type: 'address', value: ADDR },
      { name: 'ok', type: 'bool', value: 'true' },
      { name: 'root', type: 'bytes32', value: root },
      { name: 'small', type: 'uint8', value: '200' },
      { name: 'big', type: 'uint256', value: '123456789' },
      { name: 'neg', type: 'int256', value: '-5' },
      { name: 'text', type: 'string', value: 'Well Hello!' },
      { name: 'blob', type: 'bytes', value: '0x0102ff' },
    ];
    const data = hexToUint8Array(encodeCall('everything', callArgs));
    const everythingFn = fn(
      'everything',
      callArgs.map(a => [a.name, a.type]),
    );
    expect(decodeContractCall([everythingFn], data)?.args).toEqual(callArgs);
  });

  test('identifies functions with array params by selector but returns args=null', () => {
    const cases: [string, string, () => ContractFunctionParameters][] = [
      ['setIds', 'uint256[]', () => new ContractFunctionParameters().addUint256Array([1, 2])],
      ['setRoots', 'bytes32[]', () => new ContractFunctionParameters().addBytes32Array([new Uint8Array(32)])],
    ];
    for (const [name, type, build] of cases) {
      const data = build()._build(name);
      expect(decodeContractCall([fn(name, [['p', type]])], data)).toEqual({
        functionName: name,
        args: null,
      });
    }
  });

  test('dynamic-array calldata matches an address[] ABI function', () => {
    const data = new ContractFunctionParameters().addAddressArray([ADDR])._build('f');
    expect(decodeContractCall([fn('f', [['p', 'address[]']])], data)).toEqual({
      functionName: 'f',
      args: null,
    });
  });

  test('a fixed-size array parameter never matches dynamic-array calldata', () => {
    const data = new ContractFunctionParameters().addAddressArray([ADDR])._build('f');
    expect(decodeContractCall([fn('f', [['p', 'address[2]']])], data)).toBeNull();
  });

  test('uint/int aliases resolve to uint256/int256 selectors', () => {
    const data = hexToUint8Array(encodeCall('a', [{ name: 'x', type: 'uint256', value: '3' }]));
    expect(decodeContractCall([fn('a', [['x', 'uint']])], data)?.args?.[0].value).toBe('3');
    const data2 = hexToUint8Array(encodeCall('b', [{ name: 'x', type: 'int256', value: '-3' }]));
    expect(decodeContractCall([fn('b', [['x', 'int']])], data2)?.args?.[0].value).toBe('-3');
  });

  test('returns null for too-short data, unknown selector', () => {
    expect(decodeContractCall(abi, new Uint8Array([1, 2, 3]))).toBeNull();
    expect(decodeContractCall(abi, new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBeNull();
  });

  test('truncated static head (calldata shorter than one full word per param) decodes to args=null, not a wrong value', () => {
    const full = hexToUint8Array(
      encodeCall('transfer', [
        { name: 'to', type: 'address', value: ADDR },
        { name: 'amount', type: 'uint256', value: '123456789' },
      ]),
    );
    // selector (4) + full "to" word (32) + only 10 of the 32 bytes of "amount"
    const truncated = full.slice(0, 4 + 32 + 10);
    expect(decodeContractCall(abi, truncated)).toEqual({ functionName: 'transfer', args: null });
  });

  test('truncated dynamic tail data decodes to args=null, not a wrong/shorter value', () => {
    const full = hexToUint8Array(encodeCall('f', [{ name: 's', type: 'string', value: 'hello world' }]));
    // selector (4) + offset word (32) + length word (32) + only 7 of the 11 bytes of "hello world"
    // (the rest of that 32-byte-aligned tail word is just zero padding, so cutting fewer bytes
    // than that would only remove padding, not actual claimed content)
    const truncated = full.slice(0, 4 + 32 + 32 + 7);
    expect(decodeContractCall([fn('f', [['s', 'string']])], truncated)).toEqual({
      functionName: 'f',
      args: null,
    });
  });

  test('truncated dynamic length word (tail cut before the length can even be read) decodes to args=null', () => {
    const full = hexToUint8Array(encodeCall('f', [{ name: 's', type: 'string', value: 'hello world' }]));
    // selector (4) + full head word (32) + only 10 of the 32 bytes of the tail's length word
    const truncated = full.slice(0, 4 + 32 + 10);
    expect(decodeContractCall([fn('f', [['s', 'string']])], truncated)).toEqual({
      functionName: 'f',
      args: null,
    });
  });

  test('skips ABI functions whose parameter types cannot be selector-built and keeps looking', () => {
    const data = hexToUint8Array(encodeCall('pause', []));
    const mixed = [fn('weird', [['t', 'tuple']]), fn('pause', [])];
    expect(decodeContractCall(mixed, data)?.functionName).toBe('pause');
  });
});

describe('validateFunctionArgValue', () => {
  test('requires a value for every type', () => {
    expect(validateFunctionArgValue('address', '')).toBe('This field is required');
    expect(validateFunctionArgValue('uint256', '  ')).toBe('This field is required');
  });

  test('address: accepts 40-hex with or without 0x, rejects everything else', () => {
    expect(validateFunctionArgValue('address', ADDR)).toBeNull();
    expect(validateFunctionArgValue('address', ADDR.slice(2))).toBeNull();
    expect(validateFunctionArgValue('address', '0x1234')).not.toBeNull();
    expect(validateFunctionArgValue('address', '0.0.1234')).not.toBeNull();
    expect(validateFunctionArgValue('address', 'zzzz')).not.toBeNull();
  });

  test('bytes32: accepts 64-hex with or without 0x, rejects wrong length', () => {
    const word = 'ab'.repeat(32);
    expect(validateFunctionArgValue('bytes32', `0x${word}`)).toBeNull();
    expect(validateFunctionArgValue('bytes32', word)).toBeNull();
    expect(validateFunctionArgValue('bytes32', '0xab')).not.toBeNull();
  });

  test('uint*: rejects non-integers, negatives, and out-of-range values', () => {
    expect(validateFunctionArgValue('uint8', '255')).toBeNull();
    expect(validateFunctionArgValue('uint8', '256')).toBe('Must be between 0 and 255');
    expect(validateFunctionArgValue('uint8', '-1')).toBe('Must be between 0 and 255');
    expect(validateFunctionArgValue('uint256', '1.5')).toBe('Must be a whole number');
    expect(validateFunctionArgValue('uint', '5')).toBeNull(); // bare uint normalizes to uint256
  });

  test('int*: allows negatives within the signed range, rejects out-of-range values', () => {
    expect(validateFunctionArgValue('int8', '-128')).toBeNull();
    expect(validateFunctionArgValue('int8', '127')).toBeNull();
    expect(validateFunctionArgValue('int8', '-129')).toBe('Must be between -128 and 127');
    expect(validateFunctionArgValue('int8', '128')).toBe('Must be between -128 and 127');
  });

  test('bool: no format/range validation beyond non-empty', () => {
    expect(validateFunctionArgValue('bool', 'true')).toBeNull();
    expect(validateFunctionArgValue('bool', 'anything')).toBeNull();
  });
});

describe('sanitizeFunctionArgInput', () => {
  test('address: lowercases, strips non-hex, caps at 42 chars', () => {
    expect(sanitizeFunctionArgInput('address', '0xABCzz 123')).toBe('0xabc123');
    expect(sanitizeFunctionArgInput('address', '0x' + 'a'.repeat(50))).toBe(
      '0x' + 'a'.repeat(40),
    );
  });

  test('bytes32: lowercases, strips non-hex, caps at 66 chars', () => {
    expect(sanitizeFunctionArgInput('bytes32', '0X' + 'AB'.repeat(40))).toBe(
      '0x' + 'ab'.repeat(32),
    );
  });

  test('uint*: strips everything but digits, including a stray minus', () => {
    expect(sanitizeFunctionArgInput('uint256', '12-3abc')).toBe('123');
    expect(sanitizeFunctionArgInput('uint8', '-5')).toBe('5');
    expect(sanitizeFunctionArgInput('uint', '7')).toBe('7'); // bare uint normalizes to uint256
  });

  test('int*: keeps a single leading minus, strips everything else', () => {
    expect(sanitizeFunctionArgInput('int256', '-12-3abc')).toBe('-123');
    expect(sanitizeFunctionArgInput('int8', '12-3')).toBe('123');
    expect(sanitizeFunctionArgInput('int8', '-')).toBe('-');
  });

  test('bool and unsupported types pass through unchanged', () => {
    expect(sanitizeFunctionArgInput('bool', 'true')).toBe('true');
    expect(sanitizeFunctionArgInput('string', 'hello world')).toBe('hello world');
  });
});

describe('isAllowedFunctionArgKey', () => {
  test('address/bytes32: allows hex digits and x, rejects other letters', () => {
    expect(isAllowedFunctionArgKey('address', 'a', '')).toBe(true);
    expect(isAllowedFunctionArgKey('address', 'x', '0')).toBe(true);
    expect(isAllowedFunctionArgKey('bytes32', 'g', '')).toBe(false);
  });

  test('uint*: allows digits, rejects a minus entirely', () => {
    expect(isAllowedFunctionArgKey('uint256', '5', '12')).toBe(true);
    expect(isAllowedFunctionArgKey('uint256', '-', '')).toBe(false);
    expect(isAllowedFunctionArgKey('uint8', 'a', '')).toBe(false);
  });

  test('int*: allows a single leading minus, rejects a second one', () => {
    expect(isAllowedFunctionArgKey('int256', '-', '')).toBe(true);
    expect(isAllowedFunctionArgKey('int256', '-', '-5')).toBe(false);
    expect(isAllowedFunctionArgKey('int8', '5', '-1')).toBe(true);
  });

  test('bool and unsupported types are unrestricted', () => {
    expect(isAllowedFunctionArgKey('bool', 'z', '')).toBe(true);
    expect(isAllowedFunctionArgKey('string', 'z', '')).toBe(true);
  });
});
