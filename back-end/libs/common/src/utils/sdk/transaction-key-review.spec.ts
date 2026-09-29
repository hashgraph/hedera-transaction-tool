import { AccountCreateTransaction, ContractId, DelegateContractId, FileCreateTransaction, FileUpdateTransaction, Key, KeyList, PrivateKey } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import { assertTransactionKeysReviewable } from './transaction-key-review';
import { flattenKeyList, hasValidSignatureKey } from './key';

const pk = PrivateKey.generateED25519().publicKey;
function envelope(key: proto.IKey) {
  const bodyBytes = proto.TransactionBody.encode({ cryptoCreateAccount: { key } }).finish();
  return { signedTransactionBytes: proto.SignedTransaction.encode({ bodyBytes }).finish() };
}

describe('check transaction keys are reviewable before accepting signatures', () => {
  test.each([ContractId, DelegateContractId])('reviewable contract keys (%p) are accepted', Type => {
    const contract = Type.fromString('0.0.456');
    const keys = new KeyList([pk, new KeyList([contract])], 1);
    expect(() => assertTransactionKeysReviewable(new AccountCreateTransaction().setKey(keys).toBytes())).not.toThrow();
    expect(flattenKeyList(keys).map(key => key.toStringRaw())).toEqual([pk.toStringRaw()]);
    expect(flattenKeyList(contract)).toEqual([]);
    expect(hasValidSignatureKey([pk.toStringRaw()], keys)).toBe(true);
    expect(hasValidSignatureKey([pk.toStringRaw()], new KeyList([pk, contract], 2))).toBe(false);
  });

  test.each([FileCreateTransaction, FileUpdateTransaction])('accepts file keys (%p)', Type => {
    expect(() => assertTransactionKeysReviewable(new Type().setKeys([pk, ContractId.fromString('0.0.456')]).toBytes())).not.toThrow();
    expect(() => assertTransactionKeysReviewable(new Type().setKeys([]).toBytes())).not.toThrow();
  });

  test.each([{}, { RSA_3072: new Uint8Array([1]) }, { ECDSA_384: new Uint8Array([1]) }])('unsupported protobuf components are rejected', key => {
    for (const component of [key, { thresholdKey: { threshold: 1, keys: { keys: [pk._toProtobufKey(), key] } } }]) {
      const bytes = proto.TransactionList.encode({ transactionList: [envelope(component)] }).finish();
      expect(() => assertTransactionKeysReviewable(bytes)).toThrow('Unsupported key type');
    }
  });

  test('every node-specific body and the legacy bodyBytes envelope are checked', () => {
    const unsupported = envelope({});
    const bytes = proto.TransactionList.encode({ transactionList: [envelope(pk._toProtobufKey()), unsupported] }).finish();
    expect(() => assertTransactionKeysReviewable(bytes)).toThrow('Unsupported key type');
    const bodyBytes = proto.SignedTransaction.decode(unsupported.signedTransactionBytes).bodyBytes;
    expect(() => assertTransactionKeysReviewable(proto.Transaction.encode({ bodyBytes }).finish())).toThrow('Unsupported key type');
  });

  test('unknown components found during public-key extraction will throw', () => {
    expect(() => flattenKeyList({} as Key)).toThrow('Unsupported key type');
    expect(() => flattenKeyList(new KeyList([pk, new KeyList([{} as Key])], 1))).toThrow('Unsupported key type');
  });
});
