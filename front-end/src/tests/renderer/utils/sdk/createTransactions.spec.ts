// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { Hbar, PrivateKey } from '@hiero-ledger/sdk';

import {
  createFileAppendTransaction,
  createFileCreateTransaction,
  createFileUpdateTransaction,
  createRegisteredNodeUpdateTransaction,
  type FileAppendData,
  type FileData,
  type FileUpdateData,
  getRegisteredServiceEndpoints,
  type RegisteredEndpointType,
  type RegisteredNodeUpdateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';
import { compareKeys } from '@renderer/utils';
import { compareServiceEndpoints } from '@renderer/utils/sdk/registeredServiceEndpoints.ts';

describe('createTransactions file contents', () => {
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

describe('createRegisteredNodeUpdateTransaction', () => {
  const commonData: TransactionCommonData = {
    payerId: '0.0.1001',
    validStart: new Date(Date.now() + 60_000),
    maxTransactionFee: new Hbar(2),
    transactionMemo: '',
  };

  const registeredNodeUpdateData: RegisteredNodeUpdateData = {
    registeredNodeId: '41',
    description: 'Nice node description',
    adminKey: PrivateKey.generateECDSA().publicKey,
    serviceEndpoints: [
      {
        ipAddressV4: null,
        port: '42',
        domainName: 'example.com',
        type: 'blockNode',
        requiresTls: false,
        endpointApis: [43],
      },
    ],
  };

  const data: TransactionCommonData & RegisteredNodeUpdateData = {
    ...commonData,
    ...registeredNodeUpdateData,
  };

  test('createRegisteredNodeUpdateTransaction() without baseline', () => {
    const t = createRegisteredNodeUpdateTransaction(data, null);

    expect(t.transactionId?.accountId?.toString()).toBe(commonData.payerId);
    expect(t.transactionId?.validStart?.toDate()?.getTime()).toBe(commonData.validStart.getTime());
    expect(t.maxTransactionFee!.toBigNumber().eq(commonData.maxTransactionFee.toBigNumber())).toBe(
      true,
    );
    expect(t.transactionMemo).toBe(commonData.transactionMemo);

    expect(t.registeredNodeId?.toString()).toBe(registeredNodeUpdateData.registeredNodeId);
    expect(t.description).toBe(registeredNodeUpdateData.description);
    expect(t.adminKey !== null && compareKeys(t.adminKey, registeredNodeUpdateData.adminKey!)).toBe(
      true,
    );

    expect(t.serviceEndpoints).not.toBe(null);
    expect(
      t.serviceEndpoints !== null &&
        compareServiceEndpoints(
          t.serviceEndpoints,
          getRegisteredServiceEndpoints(registeredNodeUpdateData.serviceEndpoints),
        ),
    ).toBe(true);
  });

  test('createRegisteredNodeUpdateTransaction() with baseline', () => {
    const baseline = createRegisteredNodeUpdateTransaction(data, null);
    const t = createRegisteredNodeUpdateTransaction(data, baseline);

    expect(t.transactionId?.accountId?.toString()).toBe(commonData.payerId);
    expect(t.transactionId?.validStart?.toDate()?.getTime()).toBe(commonData.validStart.getTime());
    expect(t.maxTransactionFee!.toBigNumber().eq(commonData.maxTransactionFee.toBigNumber())).toBe(
      true,
    );
    expect(t.transactionMemo).toBe(commonData.transactionMemo);

    expect(t.registeredNodeId?.toString()).toBe(registeredNodeUpdateData.registeredNodeId);
    expect(t.description).toBe(null);
    expect(t.adminKey).toBe(null);
    expect(t.serviceEndpoints).toBe(null);
  });

  test('with description changed', () => {
    const baseline = createRegisteredNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, description: 'Another description' };
    const t = createRegisteredNodeUpdateTransaction(modifiedData, baseline);

    expect(t.description).toBe(modifiedData.description);
  });

  test('with adminKey changed', () => {
    const baseline = createRegisteredNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, adminKey: PrivateKey.generateECDSA().publicKey };
    const t = createRegisteredNodeUpdateTransaction(modifiedData, baseline);

    expect(t.adminKey !== null && compareKeys(t.adminKey, modifiedData.adminKey)).toBe(true);
  });

  test('with serviceEndpoints changed', () => {
    const baseline = createRegisteredNodeUpdateTransaction(data, null);
    const modifiedData = {
      ...data,
      serviceEndpoints: [
        {
          ipAddressV4: null,
          port: '42',
          domainName: 'example.com',
          type: 'blockNode' as RegisteredEndpointType,
          requiresTls: false,
          endpointApis: [43],
        },
        {
          ipAddressV4: null,
          port: '1212',
          domainName: 'test.com',
          type: 'mirrorNode' as RegisteredEndpointType,
          requiresTls: true,
        },
      ],
    };
    const t = createRegisteredNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.serviceEndpoints !== null &&
        compareServiceEndpoints(
          t.serviceEndpoints,
          getRegisteredServiceEndpoints(modifiedData.serviceEndpoints),
        ),
    ).toBe(true);
  });
});
