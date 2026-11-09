// @vitest-environment node
import { describe, expect, test } from 'vitest';

import {
  createRole,
  getFunctionSignature,
  parseFunctionTags,
  parseRoles,
  roleHolderSummary,
  type ContractRole,
} from '@renderer/utils/sdk/contractRoles';

describe('parseRoles', () => {
  test('returns [] for empty/nullish input', () => {
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles('')).toEqual([]);
  });

  test('parses a JSON array', () => {
    const roles = [{ id: '1', name: 'ADMIN', verified: false, holderType: 'unassigned' }];
    expect(parseRoles(JSON.stringify(roles))).toEqual(roles);
  });

  test('returns [] for non-array JSON or invalid JSON', () => {
    expect(parseRoles('{"a":1}')).toEqual([]);
    expect(parseRoles('not json')).toEqual([]);
  });
});

describe('parseFunctionTags', () => {
  test('returns {} for empty/nullish input', () => {
    expect(parseFunctionTags(null)).toEqual({});
    expect(parseFunctionTags(undefined)).toEqual({});
    expect(parseFunctionTags('')).toEqual({});
  });

  test('parses an object', () => {
    expect(parseFunctionTags('{"mint(address,uint256)":"role-1"}')).toEqual({
      'mint(address,uint256)': 'role-1',
    });
  });

  test('returns {} for JSON null, or invalid JSON', () => {
    expect(parseFunctionTags('null')).toEqual({});
    expect(parseFunctionTags('{bad')).toEqual({});
  });
});

describe('getFunctionSignature', () => {
  test('builds name(type,type) with no spaces', () => {
    expect(
      getFunctionSignature({
        type: 'function',
        name: 'transfer',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amt', type: 'uint256' },
        ],
        outputs: [],
      }),
    ).toBe('transfer(address,uint256)');
  });

  test('handles zero inputs', () => {
    expect(getFunctionSignature({ type: 'function', name: 'pause', inputs: [], outputs: [] })).toBe(
      'pause()',
    );
  });
});

describe('createRole', () => {
  test('adds a unique id and verified=false while keeping the given fields', () => {
    const a = createRole({ name: 'ADMIN', holderType: 'unassigned' });
    const b = createRole({ name: 'ADMIN', holderType: 'unassigned' });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ name: 'ADMIN', holderType: 'unassigned', verified: false });
  });
});

describe('roleHolderSummary', () => {
  const base: ContractRole = { id: '1', name: 'R', verified: false, holderType: 'unassigned' };

  test('account with and without id', () => {
    expect(roleHolderSummary({ ...base, holderType: 'account', holderAccountId: '0.0.5' })).toBe(
      'Account: 0.0.5',
    );
    expect(roleHolderSummary({ ...base, holderType: 'account' })).toBe('Account: not set');
  });

  test('contract with and without ref', () => {
    expect(roleHolderSummary({ ...base, holderType: 'contract', holderContractRef: '0.0.9' })).toBe(
      'Contract: 0.0.9',
    );
    expect(roleHolderSummary({ ...base, holderType: 'contract' })).toBe('Contract: not set');
  });

  test('unassigned', () => {
    expect(roleHolderSummary(base)).toBe('Unassigned');
  });
});
