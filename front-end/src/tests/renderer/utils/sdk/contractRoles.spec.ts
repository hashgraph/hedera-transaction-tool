// @vitest-environment node
import { describe, expect, test } from 'vitest';

import { createRole, getFunctionSignature, parseRoles } from '@renderer/utils/sdk/contractRoles';

describe('parseRoles', () => {
  test('returns [] for empty/nullish input', () => {
    expect(parseRoles(null)).toEqual([]);
    expect(parseRoles(undefined)).toEqual([]);
    expect(parseRoles('')).toEqual([]);
  });

  test('parses a JSON array', () => {
    const roles = [{ id: '1', name: 'ADMIN', verified: false }];
    expect(parseRoles(JSON.stringify(roles))).toEqual(roles);
  });

  test('returns [] for non-array JSON or invalid JSON', () => {
    expect(parseRoles('{"a":1}')).toEqual([]);
    expect(parseRoles('not json')).toEqual([]);
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
    const a = createRole({ name: 'ADMIN' });
    const b = createRole({ name: 'ADMIN' });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ name: 'ADMIN', verified: false });
  });
});
