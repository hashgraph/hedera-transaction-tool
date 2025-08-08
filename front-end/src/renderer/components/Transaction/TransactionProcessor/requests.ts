import type { Hbar, Key } from '@hashgraph/sdk';
import type { IAccountInfoParsed } from '@shared/interfaces';
import type { AccountUpdateDataMultiple } from '@renderer/utils';

import { AccountId, KeyList } from '@hashgraph/sdk';

import { getAccountInfo } from '@renderer/services/mirrorNodeDataService';

/* Default Request */
export class BaseRequest {
  requestKey: Key | null;
  submitManually: boolean;
  reminderMillisecondsBefore: number | null;

  constructor(submitManually: boolean, reminderMillisecondsBefore: number | null) {
    this.submitManually = submitManually;
    this.reminderMillisecondsBefore = reminderMillisecondsBefore;
    this.requestKey = null;
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
    this.requestKey = opts.transactionKey;
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
  requestKey: Key | null;
  displayName: string;
  payerId?: string;
  baseValidStart?: Date;
  maxTransactionFee?: Hbar;

  constructor(opts: {
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
    displayName: string;
    payerId?: string;
    baseValidStart?: Date;
    maxTransactionFee?: Hbar;
  }) {
    super(opts.submitManually, opts.reminderMillisecondsBefore);

    this.requestKey = null;
    this.displayName = opts.displayName;
    this.payerId = opts.payerId;
    this.baseValidStart = opts.baseValidStart;
    this.maxTransactionFee = opts.maxTransactionFee;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deriveRequestKey(mirrorNodeBaseURL: string) {
    throw new Error('Not implemented');
  }
}

/** Multiple Accounts Update Request */
export class MultipleAccountUpdateRequest extends CustomRequest {
  accountIds: string[];
  key: Key;
  accountIsPayer: boolean;
  accountInfoMap: Map<string, IAccountInfoParsed>;

  constructor(opts: {
    payerId?: string;
    baseValidStart?: Date;
    maxTransactionFee?: Hbar;
    accountIds: string[];
    key: Key;
    accountIsPayer: boolean;
    submitManually: boolean;
    reminderMillisecondsBefore: number | null;
  }) {
    super({ ...opts, displayName: 'Multiple Accounts Update' });

    this.accountIds = opts.accountIds;
    this.key = opts.key;
    this.accountIsPayer = opts.accountIsPayer;
    this.requestKey = new KeyList([this.key]);
    this.accountInfoMap = new Map<string, IAccountInfoParsed>();
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

  async deriveRequestKey(mirrorNodeBaseURL: string) {
    const keyList = new KeyList();

    const withoutChecksum = this.accountIds.map(acc => AccountId.fromString(acc).toString());
    for (const account of withoutChecksum) {
      if (!this.accountInfoMap.has(account)) {
        const data = await getAccountInfo(account, mirrorNodeBaseURL);
        if (data) {
          this.accountInfoMap.set(account, data);
        }
      }
      const data = this.accountInfoMap.get(account);
      if (data?.key) {
        keyList.push(data.key);
      }
    }

    for (const account of this.accountIds) {
      const accountInfo = this.accountInfoMap.get(account);
      if (accountInfo?.key) {
        keyList.push(accountInfo.key);
      }
    }

    if (this.payerId && !this.accountIsPayer) {
      const payerWithoutChecksum = AccountId.fromString(this.payerId).toString();
      if (!this.accountInfoMap.has(payerWithoutChecksum)) {
        const payerInfo = await getAccountInfo(payerWithoutChecksum, mirrorNodeBaseURL);
        if (payerInfo) {
          this.accountInfoMap.set(payerWithoutChecksum, payerInfo);
        }
      }
      const payerInfo = this.accountInfoMap.get(payerWithoutChecksum);
      if (payerInfo?.key) {
        keyList.push(payerInfo.key);
      }
    }

    this.requestKey = keyList;
  }

  getAccountIdTransactionKey(accountId: string) {
    const keyList = new KeyList([this.key]);
    const accountInfo = this.accountInfoMap.get(accountId);

    if (accountInfo) {
      accountInfo.key && keyList.push(accountInfo.key);

      if (!this.accountIsPayer && this.payerId) {
        const payerInfo = this.accountInfoMap.get(this.payerId);
        payerInfo?.key && keyList.push(payerInfo.key);
      }
    }

    return keyList;
  }
}
