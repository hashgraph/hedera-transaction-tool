import { TransactionReceipt, TransactionResponse } from '@hashgraph/sdk';

import TransactionProcessor from './TransactionProcessor.vue';
import type { CustomRequest, TransactionRequest } from './requests';

export * from './requests';

export type Processable = TransactionRequest | CustomRequest;

export interface Handler {
  setNext: (handler: Handler) => void;
  handle: (transactionRequest: Processable) => void;
}

export function assertHandlerExists<T extends abstract new (...args: any) => any>(
  handler: InstanceType<T> | null,
  name: string,
): asserts handler is InstanceType<T> {
  if (!handler) throw new Error(`${name} handler is not provided`);
}

export type ExecutedSuccessData = {
  success: true;
  response: TransactionResponse;
  receipt: TransactionReceipt;
};

export type ExecutedData =
  | {
      success: boolean;
      response: TransactionResponse | null;
      receipt: TransactionReceipt | null;
    }
  | ExecutedSuccessData;

export default TransactionProcessor;
