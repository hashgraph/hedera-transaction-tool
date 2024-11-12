import { FileUpdateTransaction, type Transaction } from '@hashgraph/sdk';

const TRASURY = '0.0.2';
const SYSTEM_ADMIN = '0.0.50';
const ADDRESS_BOOK_ADMIN = '0.0.55';
const FEE_SCHEDULES_ADMIN = '0.0.56';
const EXCHANGE_RATE_ADMIN = '0.0.57';
const FREEZE_ADMIN = '0.0.58';

const fileIdPermissions: { [key: string]: string[] } = {
  '0.0.101': [TRASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN],
  '0.0.102': [TRASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN],
  '0.0.111': [TRASURY, SYSTEM_ADMIN, FEE_SCHEDULES_ADMIN],
  '0.0.112': [TRASURY, SYSTEM_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.121': [TRASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.122': [TRASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.123': [TRASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.150': [TRASURY, SYSTEM_ADMIN, FREEZE_ADMIN],
};

export const validateFileUpdateTransaction = (transaction: Transaction) => {
  if (!(transaction instanceof FileUpdateTransaction)) {
    return;
  }

  const payerId = transaction.transactionId?.accountId?.toString();
  const fileId = transaction.fileId;

  if (!fileId || !payerId) {
    return;
  }

  const permissions = fileIdPermissions[fileId.toString()];
  if (!permissions) {
    return;
  }

  if (!permissions.includes(payerId)) {
    throw new Error('Invalid payer ID: System files can only be updated by authorized accounts');
  }
};

export const transactionIs = <T extends Transaction>(
  type: new (...args: any[]) => T,
  transaction: Transaction,
): transaction is T => {
  return transaction instanceof type;
};
