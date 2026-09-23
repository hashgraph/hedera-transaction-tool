// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { ContractId, DelegateContractId, Key, KeyList, PrivateKey } from '@hiero-ledger/sdk';
import { flattenKeyList } from '@renderer/services/keyPairService';

describe('keyPairService.flattenKeyList - contract components', () => {
  const pk = PrivateKey.generateED25519().publicKey;

  test.each([ContractId, DelegateContractId])(
    'extracts only public keys from known components',
    Type => {
      const contract = Type.fromString('0.0.456');
      expect(flattenKeyList(contract)).toEqual([]);
      const key = new KeyList([pk, new KeyList([contract])], 1);
      expect(flattenKeyList(key).map(k => k.toStringRaw())).toEqual([pk.toStringRaw()]);
      expect(key.threshold).toBe(1);
      expect((key.toArray()[1] as KeyList).toArray()[0]).toBe(contract);
    },
  );

  test('rejects unknown standalone and nested components', () => {
    const unknown = {} as Key;
    for (const key of [unknown, new KeyList([pk, new KeyList([unknown])], 1)]) {
      expect(() => flattenKeyList(key)).toThrow('Unsupported key type');
    }
  });
});
