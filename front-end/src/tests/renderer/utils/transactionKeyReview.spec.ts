// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { assertTransactionKeysReviewable } from '@renderer/utils/transactionKeyReview';
import {
  AccountCreateTransaction,
  ContractId,
  DelegateContractId,
  FileCreateTransaction,
  FileUpdateTransaction,
  Key,
  KeyList,
  PrivateKey,
  Transaction,
} from '@hiero-ledger/sdk';

describe('transaction body key validation', () => {
  const pk = PrivateKey.generateED25519().publicKey;

  test.each([FileCreateTransaction, FileUpdateTransaction])(
    'accepts SDK file key arrays before and after serialization (%p)',
    Type => {
      const transaction = new Type().setKeys([
        pk,
        new KeyList(
          [ContractId.fromString('0.0.456'), DelegateContractId.fromString('0.0.457')],
          1,
        ),
      ]);
      expect(() => assertTransactionKeysReviewable(transaction)).not.toThrow();
      expect(() =>
        assertTransactionKeysReviewable(Transaction.fromBytes(transaction.toBytes())),
      ).not.toThrow();
      expect(() => assertTransactionKeysReviewable(new Type().setKeys([]))).not.toThrow();
    },
  );

  test('rejects unknown components inside file key arrays', () => {
    for (const key of [{} as Key, new KeyList([pk, {} as Key], 1)]) {
      expect(() =>
        assertTransactionKeysReviewable(new FileCreateTransaction().setKeys([pk, key])),
      ).toThrow('Unsupported key type');
    }
  });

  test('absent and supported nested keys are accepted', () => {
    expect(() => assertTransactionKeysReviewable({})).not.toThrow();
    expect(() =>
      assertTransactionKeysReviewable({ key: new KeyList([pk, new KeyList([pk])]) }),
    ).not.toThrow();
  });

  test.each(['key', 'adminKey', 'keys'])('unknown nested %s components are rejected', field => {
    expect(() =>
      assertTransactionKeysReviewable({ [field]: new KeyList([pk, {} as Key], 1) }),
    ).toThrow('Unsupported key type');
  });

  test.each(['key', 'adminKey', 'keys'])('%s distinguishes absent from unsupported keys', field => {
    for (const key of [null, undefined]) {
      expect(() => assertTransactionKeysReviewable({ [field]: key })).not.toThrow();
    }
    for (const key of [{}, false, 0, '']) {
      expect(() => assertTransactionKeysReviewable({ [field]: key })).toThrow(
        'Unsupported key type',
      );
    }
  });

  test.each([ContractId, DelegateContractId])('reviewable %s component is accepted', Type => {
    const contract = Type.fromString('0.0.456');
    for (const field of ['key', 'adminKey', 'keys']) {
      expect(() => assertTransactionKeysReviewable({ [field]: contract })).not.toThrow();
    }
    const key = new KeyList([pk, new KeyList([contract])], 1);
    expect(() =>
      assertTransactionKeysReviewable(new AccountCreateTransaction().setKey(key)),
    ).not.toThrow();
  });
});
