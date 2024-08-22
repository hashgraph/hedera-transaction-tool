import { Key } from '@hashgraph/sdk';

import TransactionProcessor from './TransactionProcessor.vue';

export interface TransactionRequest {
  transactionKey: Key;
  transactionBytes: Uint8Array;
}

export interface Handler {
  setNext: (handler: Handler) => void;
  handle: (transactionRequest: TransactionRequest) => void;
}

export default TransactionProcessor;
