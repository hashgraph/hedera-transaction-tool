import type { Transaction } from '@hashgraph/sdk';
import type { TransactionCommonData } from '@renderer/utils/sdk/createTransactions';

import BaseTransaction from './BaseTransaction.vue';

export type CreateTransactionFunc = (commonData: TransactionCommonData) => Transaction;

export default BaseTransaction;
