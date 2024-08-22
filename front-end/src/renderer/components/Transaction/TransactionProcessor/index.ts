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

export function assertHandlerExists<T extends abstract new (...args: any) => any>(
  handler,
  name,
): asserts handler is InstanceType<T> {
  if (!handler) throw new Error(`${name} handler is not provided`);
}

export default TransactionProcessor;
