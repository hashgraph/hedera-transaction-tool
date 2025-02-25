import type { Key } from '@hashgraph/sdk';
import type { IAccountInfoParsed } from '@main/shared/interfaces';
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

  constructor(submitManually: boolean, reminderMillisecondsBefore: number | null) {
    super(submitManually, reminderMillisecondsBefore);

    this.requestKey = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deriveRequestKey(mirrorNodeBaseURL: string) {
    throw new Error('Not implemented');
  }
}

/** Multiple Accounts Update Request */
export class MultipleAccountUpdateRequest extends CustomRequest {
  payerAccountId: string | null;
  accountIds: string[];
  key: Key;
  accountIsPayer: boolean;

  constructor(opts: {
    payerAccountId: string;
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

    if (!this.accountIsPayer) {
      this.payerAccountId = opts.payerAccountId;
    } else {
      this.payerAccountId = null;
    }

    this.requestKey = new KeyList([this.key]);
  }

  static fromAccountUpdateData(data: AccountUpdateDataMultiple) {
    if (!data.key) {
      throw new Error('Key is required');
    }

    return new MultipleAccountUpdateRequest({
      payerAccountId: data.payerId,
      accountIds: data.accountIds,
      key: data.key,
      accountIsPayer: data.accountIsPayer,
      submitManually: false,
      reminderMillisecondsBefore: null,
    });
  }

  async deriveRequestKey(mirrorNodeBaseURL: string) {
    const keyList = new KeyList();
    const accountInfoMap = new Map<string, IAccountInfoParsed>();

    const withoutChecksum = this.accountIds.map(acc => AccountId.fromString(acc).toString());
    for (const account of withoutChecksum) {
      if (!accountInfoMap.has(account)) {
        const data = await getAccountInfo(account, mirrorNodeBaseURL);
        if (data) {
          accountInfoMap.set(account, data);
        }
      }
      const data = accountInfoMap.get(account);
      if (data?.key) {
        keyList.push(data.key);
      }
    }

    for (const account of this.accountIds) {
      const accountInfo = accountInfoMap.get(account);
      if (accountInfo?.key) {
        keyList.push(accountInfo.key);
      }
    }

    if (this.payerAccountId) {
      const payerWithoutChecksum = AccountId.fromString(this.payerAccountId).toString();
      if (!accountInfoMap.has(payerWithoutChecksum)) {
        const payerInfo = await getAccountInfo(payerWithoutChecksum, mirrorNodeBaseURL);
        if (payerInfo) {
          accountInfoMap.set(payerWithoutChecksum, payerInfo);
        }
      }
      const payerInfo = accountInfoMap.get(payerWithoutChecksum);
      if (payerInfo?.key) {
        keyList.push(payerInfo.key);
      }
    }

    this.requestKey = keyList;
  }
}
