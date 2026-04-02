import type { Transaction } from '@hiero-ledger/sdk';
import type { TransactionCommonData } from '@renderer/utils/sdk';

import BaseTransaction from './BaseTransaction.vue';

export type CreateTransactionFunc = (commonData: TransactionCommonData) => Transaction;

export default BaseTransaction;
