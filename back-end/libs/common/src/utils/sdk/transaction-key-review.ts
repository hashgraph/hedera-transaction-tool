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
  // root, so using `instanceof proto.Key` would be unreliable.
  if (value.constructor.name === 'Key') {
    const nonNullProperties = Object.entries(value).filter(([, entry]) => entry != null);
    const fields = nonNullProperties.map(([field]) => field);

    if (fields.length !== 1 || !supportedKeyFields.has(fields[0])) {
      throw new Error('Unsupported key type: transaction cannot be reviewed or signed');
    }
    // Flattening validates every component, even when a threshold is already met.
    flattenKeyList(Key._fromProtobufKey(value as proto.IKey));
  }
  Object.values(value).forEach(assertBodyKeysReviewable);
}

// Make sure all body keys (including keys not required to sign) are reviewable, i.e. contain only components
// the UI can display, before accepting signatures */
export function assertTransactionKeysReviewable(bytes: Uint8Array): void {
  const list = proto.TransactionList.decode(bytes).transactionList;
  const transactions = list.length ? list : [proto.Transaction.decode(bytes)];
  for (const transaction of transactions) {
    if (transaction.body) {
      assertBodyKeysReviewable(transaction.body);
    }
    if (transaction.bodyBytes?.length) {
      assertBodyKeysReviewable(proto.TransactionBody.decode(transaction.bodyBytes));
    }
    if (transaction.signedTransactionBytes?.length) {
      const signed = proto.SignedTransaction.decode(transaction.signedTransactionBytes);
      assertBodyKeysReviewable(proto.TransactionBody.decode(signed.bodyBytes!));
    }
  }
}
