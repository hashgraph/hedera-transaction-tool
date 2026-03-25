import type { ITransaction, ITransactionFull, TransactionFile } from '@shared/interfaces';
import { type PrivateKey, Transaction } from '@hashgraph/sdk';
import { hexToUint8Array } from '@renderer/utils/index.ts';
import { javaFormatArrayHashCode } from '@shared/utils/byteUtils.ts';
import { format } from 'date-fns';

export const generateTransactionV1ExportContent = async (
  orgTransaction: ITransactionFull,
  key: PrivateKey,
  defaultDescription?: string,
) => {
  const originalBytes = hexToUint8Array(orgTransaction.transactionBytes);
  const sdkTransaction = Transaction.fromBytes(originalBytes);

  const transactionBytes = sdkTransaction.getSignatures().size === 0
    ? (await sdkTransaction.sign(key)).toBytes()
    : originalBytes;

  const jsonContent = JSON.stringify({
    Author: orgTransaction.creatorEmail,
    Contents: orgTransaction.description || defaultDescription || '',
    Timestamp: format(new Date(orgTransaction.createdAt), 'yyyy-MM-dd HH:mm:ss'),
  });

  return { transactionBytes, jsonContent };
};

export const generateTransactionV2ExportContent = (
  orgTransactions: ITransaction[],
  network: string,
): TransactionFile => {
  const result: TransactionFile = {
    network: network,
    items: [],
  };
  for (const tx of orgTransactions) {
    result.items.push({
      name: tx.name,
      description: tx.description,
      transactionBytes: tx.transactionBytes,
      creatorEmail: tx.creatorEmail,
    });
  }
  return result;
};

export const generateTransactionExportFileName = (orgTransaction: ITransaction) => {
  const transactionBytes = hexToUint8Array(orgTransaction.transactionBytes);
  const sdkTransaction = Transaction.fromBytes(transactionBytes);

  // Use TTv1 file name format:  `${epochSeconds}_${accountId}_${hash}.tx`
  const validStart = sdkTransaction!.transactionId!.validStart;
  const accountId = sdkTransaction.transactionId!.accountId!.toString();
  const hash = javaFormatArrayHashCode(transactionBytes);

  return `${validStart!.seconds}_${accountId}_${hash}`;
};
