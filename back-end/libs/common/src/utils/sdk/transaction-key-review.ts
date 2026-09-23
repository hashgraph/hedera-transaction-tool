import { Key } from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';
import { flattenKeyList } from './key';

const supportedKeyFields = new Set([
  'contractID', 'delegatableContractId', 'ed25519', 'ECDSASecp256k1', 'keyList', 'thresholdKey',
]);

function assertBodyKeysReviewable(value: unknown): void {
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
    return;
  }

  // Generated decoders can use a different Key constructor via protobufjs's shared
  // root, so instanceof proto.Key is unreliable. These are decoded messages only.
  if (value.constructor.name === 'Key') {
    const fields = Object.entries(value).filter(([, entry]) => entry != null).map(([field]) => field);
    if (fields.length !== 1 || !supportedKeyFields.has(fields[0])) {
      throw new Error('Unsupported key type: transaction cannot be reviewed or signed');
    }
    // SDK conversion alone is insufficient: unsupported components can become null.
    // Flattening validates every component, even when a threshold is already met.
    flattenKeyList(Key._fromProtobufKey(value as proto.IKey));
  }
  Object.values(value).forEach(assertBodyKeysReviewable);
}

/** Validate body keys before accepting signatures, including keys not required to sign. */
export function assertTransactionKeysReviewable(bytes: Uint8Array): void {
  const list = proto.TransactionList.decode(bytes).transactionList;
  const transactions = list.length ? list : [proto.Transaction.decode(bytes)];
  for (const transaction of transactions) {
    if (transaction.body) assertBodyKeysReviewable(transaction.body);
    if (transaction.bodyBytes?.length) {
      assertBodyKeysReviewable(proto.TransactionBody.decode(transaction.bodyBytes));
    }
    if (transaction.signedTransactionBytes?.length) {
      const signed = proto.SignedTransaction.decode(transaction.signedTransactionBytes);
      assertBodyKeysReviewable(proto.TransactionBody.decode(signed.bodyBytes!));
    }
  }
}
