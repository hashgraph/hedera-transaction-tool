import type { Key } from '@hashgraph/sdk';
import type { AccountUpdateDataMultiple } from '@renderer/utils';

/* Default Request */
export class TransactionRequest {
  transactionKey: Key;
  transactionBytes: Uint8Array;
  name: string;
  description: string;
  submitManually: boolean;
  reminderMillisecondsBefore: number | null;

  constructor(opts: {
    transactionKey: Key;
    transactionBytes: Uint8Array;
    name: string;
    description: string;
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
  }) {
    this.transactionKey = opts.transactionKey;
    this.transactionBytes = opts.transactionBytes;
    this.name = opts.name;
    this.description = opts.description;
    this.submitManually = opts.submitManually;
    this.reminderMillisecondsBefore = opts.reminderMillisecondsBefore;
  }

  static fromData(data: {
    transactionKey: Key;
    transactionBytes: Uint8Array;
    name: string;
    description: string;
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
  }) {
    return new TransactionRequest(data);
  }
}

/* Custom processor requests */
export type CustomRequest = MultipleAccountUpdateRequest;

/** Multiple Accounts Update Request */
export class MultipleAccountUpdateRequest {
  accountIds: string[];
  key: Key;
  accountIsPayer: boolean;

  constructor(opts: { accountIds: string[]; key: Key; accountIsPayer: boolean }) {
    this.accountIds = opts.accountIds;
    this.key = opts.key;
    this.accountIsPayer = opts.accountIsPayer;
  }

  static fromAccountUpdateData(data: AccountUpdateDataMultiple) {
    if (!data.key) {
      throw new Error('Key is required');
    }

    return new MultipleAccountUpdateRequest({
      accountIds: data.accountIds,
      key: data.key,
      accountIsPayer: data.accountIsPayer,
    });
  }
}
