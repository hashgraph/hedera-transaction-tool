// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { ContractId, DelegateContractId, KeyList, PrivateKey } from '@hiero-ledger/sdk';
import { ableToSign } from '@renderer/utils/sdk';

describe('ableToSign contract signature requirements', () => {

  test.each([ContractId, DelegateContractId])(
    'does not count a contract as a public-key signature',
    Type => {
      const pk = PrivateKey.generateED25519().publicKey;
      const contract = Type.fromString('0.0.456');
      const signed = [pk.toStringRaw()];
      expect(ableToSign(signed, contract)).toBe(false);
      expect(ableToSign(signed, new KeyList([pk, contract], 1))).toBe(true);
      expect(ableToSign(signed, new KeyList([pk, contract], 2))).toBe(false);
    },
  );
});
