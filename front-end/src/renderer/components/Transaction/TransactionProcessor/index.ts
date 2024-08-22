import { Key } from '@hashgraph/sdk';

import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import TransactionProcessor from './TransactionProcessor.vue';

export interface TransactionRequest {
  transactionKey: Key;
  transactionBytes: Uint8Array;
  observers: number[];
  approvers: TransactionApproverDto[];
}

export interface Handler {
  setNext: (handler: Handler) => void;
  handle: (transactionRequest: TransactionRequest) => void;
}

export default TransactionProcessor;
