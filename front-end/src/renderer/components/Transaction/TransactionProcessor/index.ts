import { Transaction, TransactionReceipt, TransactionResponse } from '@hiero-ledger/sdk';

import TransactionProcessor from './TransactionProcessor.vue';
import type { CustomRequest, TransactionRequest } from './requests';
import type { ComponentExposed } from 'vue-component-type-helpers';

export * from './requests';

export type Processable<T extends Transaction> = TransactionRequest<T> | CustomRequest;

export interface Handler<T extends Transaction> {
  setNext: (handler: Handler<T>) => void;
  handle: (transactionRequest: Processable<T>) => Promise<void>;
}

export function assertHandlerExists<T>(
  handler: ComponentExposed<T> | null,
  name: string,
): asserts handler is ComponentExposed<T> {
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
