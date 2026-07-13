// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { Hbar } from '@hiero-ledger/sdk';

import {
  createFileAppendTransaction,
  createFileCreateTransaction,
  createFileUpdateTransaction,
  type FileAppendData,
  type FileData,
  type FileUpdateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';

const commonData: TransactionCommonData = {
  payerId: '0.0.1001',
  validStart: new Date(Date.now() + 60_000),
  maxTransactionFee: new Hbar(2),
  transactionMemo: '',
};

function fileData(contents: string | Uint8Array): FileData {
  return {
    ownerKey: null,
    fileMemo: '',
    expirationTime: null,
    contents,
  };
}

describe('createTransactions file contents', () => {

  test('sets string contents on file create transactions', () => {
    const contents = 'hello world';

    const transaction = createFileCreateTransaction({
      ...commonData,
      ...fileData(contents),
    });

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });

  test('sets string contents on file update transactions', () => {
    const contents = 'hello world';
    const data: TransactionCommonData & FileUpdateData = {
      ...commonData,
      ...fileData(contents),
      fileId: '0.0.150',
    };

    const transaction = createFileUpdateTransaction(data);

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });

  test('sets string contents on file append transactions', () => {
    const contents = 'hello world';
    const data: TransactionCommonData & FileAppendData = {
      ...commonData,
      fileId: '0.0.150',
      chunkSize: 1024,
      maxChunks: 1,
      contents,
    };

    const transaction = createFileAppendTransaction(data);

    expect(Array.from(transaction.contents ?? [])).toEqual(
      Array.from(new TextEncoder().encode(contents)),
    );
  });
});
