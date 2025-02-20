import type { Key } from '@hashgraph/sdk';
import type { AccountUpdateDataMultiple } from '@renderer/utils';

/* Default Request */
export class BaseRequest {
  submitManually: boolean;
  reminderMillisecondsBefore: number | null;

  constructor(submitManually: boolean, reminderMillisecondsBefore: number | null) {
    this.submitManually = submitManually;
    this.reminderMillisecondsBefore = reminderMillisecondsBefore;
  }
}

export class TransactionRequest extends BaseRequest {
  transactionKey: Key;
  transactionBytes: Uint8Array;
  name: string;
  description: string;

  constructor(opts: {
    transactionKey: Key;
    transactionBytes: Uint8Array;
    name: string;
    description: string;
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
  }) {
    super(opts.submitManually, opts.reminderMillisecondsBefore);
    this.transactionKey = opts.transactionKey;
    this.transactionBytes = opts.transactionBytes;
    this.name = opts.name;
    this.description = opts.description;
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
export class CustomRequest extends BaseRequest {
  constructor(submitManually: boolean, reminderMillisecondsBefore: number | null) {
    super(false, reminderMillisecondsBefore);
  }
}

/** Multiple Accounts Update Request */
export class MultipleAccountUpdateRequest extends CustomRequest {
  accountIds: string[];
  key: Key;
  accountIsPayer: boolean;

  constructor(opts: {
    accountIds: string[];
    key: Key;
    accountIsPayer: boolean;
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
  }) {
    super(opts.submitManually, opts.reminderMillisecondsBefore);

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
      submitManually: false,
      reminderMillisecondsBefore: null,
    });
  }
}
