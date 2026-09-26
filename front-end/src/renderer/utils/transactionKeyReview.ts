import { ContractId, KeyList, PublicKey } from '@hiero-ledger/sdk';

function assertKeyReviewable(key: unknown): void {
  // Note: DelegateContractId extends ContractId
  if (key instanceof PublicKey || key instanceof ContractId) {
    return;
  }
  if (key instanceof KeyList) {
    key.toArray().forEach(assertKeyReviewable);
    return;
  }
  throw new Error('Unsupported key type: transaction cannot be reviewed or signed');
}

// Makes sure that all the keys in the transaction are reviewable
// i.e. can be properly displayed to the user for review before signing.
export function assertTransactionKeysReviewable(transaction: object): void {
  for (const field of ['key', 'adminKey', 'keys']) {
    if (field in transaction) {
      const key = (transaction as Record<string, unknown>)[field];
      if (key != null) {
        // File transactions expose keys as Key[], not as an SDK KeyList.
        if (field === 'keys' && Array.isArray(key)) {
          key.forEach(assertKeyReviewable);
        } else {
          assertKeyReviewable(key);
        }
      }
    }
  }
}
