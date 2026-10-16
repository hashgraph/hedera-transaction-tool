// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { Hbar, PrivateKey } from '@hiero-ledger/sdk';

import {
  createFileAppendTransaction,
  createFileCreateTransaction,
  createFileUpdateTransaction,
  createNodeUpdateTransaction,
  createRegisteredNodeUpdateTransaction,
  type FileAppendData,
  type FileData,
  type FileUpdateData,
  getRegisteredServiceEndpoints,
  getServiceEndpoint,
  getServiceEndpoints,
  type NodeUpdateData,
  type RegisteredEndpointType,
  type RegisteredNodeUpdateData,
  type TransactionCommonData,
} from '@renderer/utils/sdk/createTransactions';
import { compareKeys } from '@renderer/utils';
import { compareServiceEndpoints } from '@renderer/utils/sdk/registeredServiceEndpoints.ts';
import {
  compareNodeServiceEndpoint,
  compareNodeServiceEndpoints,
} from '@renderer/utils/sdk/serviceEndpoints.ts';
import Long from 'long';

const uint8ArrayToHex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

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

describe('createNodeUpdateTransaction', () => {
  const commonData: TransactionCommonData = {
    payerId: '0.0.1001',
    validStart: new Date(Date.now() + 60_000),
    maxTransactionFee: new Hbar(2),
    transactionMemo: '',
  };

  const nodeUpdateData: NodeUpdateData = {
    nodeId: '1',
    nodeAccountId: '0.0.1003',
    description: 'Nice node description',
    gossipEndpoints: [
      {
        ipAddressV4: '127.0.0.1',
        port: '4343',
        domainName: null,
      },
      {
        ipAddressV4: null,
        port: '4444',
        domainName: 'example.com',
      },
    ],
    serviceEndpoints: [
      {
        ipAddressV4: '127.0.0.1',
        port: '4343',
        domainName: null,
      },
      {
        ipAddressV4: null,
        port: '4444',
        domainName: 'example.com',
      },
    ],
    grpcWebProxyEndpoint: {
      ipAddressV4: '127.0.0.1',
      port: '4343',
      domainName: null,
    },
    gossipCaCertificate: new Uint8Array([42, 42]),
    certificateHash: new Uint8Array([43, 43]),
    adminKey: PrivateKey.generateECDSA().publicKey,
    declineReward: true,
    associatedRegisteredNodes: ['1', '2', '3', '4'],
  };

  const data: TransactionCommonData & NodeUpdateData = {
    ...commonData,
    ...nodeUpdateData,
  };

  test('createNodeUpdateTransaction() without baseline', () => {
    const t = createNodeUpdateTransaction(data, null);

    expect(t.nodeId !== null && t.nodeId.equals(Long.fromString(data.nodeId))).toBe(true);
    expect(t.accountId?.toString()).toBe(data.nodeAccountId.toString());
    expect(t.description).toBe(data.description);
    expect(
      t.gossipEndpoints !== null &&
        compareNodeServiceEndpoints(t.gossipEndpoints, getServiceEndpoints(data.gossipEndpoints)),
    ).toBe(true);
    expect(
      t.serviceEndpoints !== null &&
        compareNodeServiceEndpoints(t.serviceEndpoints, getServiceEndpoints(data.serviceEndpoints)),
    ).toBe(true);
    expect(
      t.grpcWebProxyEndpoint !== null &&
        compareNodeServiceEndpoint(
          t.grpcWebProxyEndpoint,
          getServiceEndpoint(data.grpcWebProxyEndpoint)!,
        ),
    ).toBe(true);
    expect(
      t.certificateHash !== null &&
        uint8ArrayToHex(t.certificateHash) === uint8ArrayToHex(data.certificateHash),
    ).toBe(true);
    expect(t.adminKey !== null && compareKeys(t.adminKey, data.adminKey!)).toBe(true);
    expect(t.declineReward).toBe(data.declineReward);
    expect(
      JSON.stringify(t.associatedRegisteredNodes),
      JSON.stringify(data.associatedRegisteredNodes),
    );
  });

  test('createNodeUpdateTransaction() with baseline', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const t = createNodeUpdateTransaction(data, baseline);

    expect(t.nodeId !== null && t.nodeId.equals(Long.fromString(data.nodeId))).toBe(true);
    expect(t.accountId).toBe(null);
    expect(t.description).toBe(null);
    expect(t.gossipEndpoints).toBe(null);
    expect(t.serviceEndpoints).toBe(null);
    expect(t.grpcWebProxyEndpoint).toBe(null);
    expect(t.certificateHash).toBe(null);
    expect(t.adminKey).toBe(null);
    expect(t.declineReward).toBe(null);
    expect(t.associatedRegisteredNodes).toBe(null);
  });

  test('with accountId changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, nodeAccountId: '0.0.1010' };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(t.accountId?.toString()).toBe(modifiedData.nodeAccountId);
  });

  test('with description changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, description: 'Another description' };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(t.description).toBe(modifiedData.description);
  });

  test('with gossipEndpoints changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = {
      ...data,
      gossipEndpoints: [
        {
          ipAddressV4: null,
          port: '4343',
          domainName: 'example.com',
        },
      ],
    };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.gossipEndpoints !== null &&
        compareNodeServiceEndpoints(
          t.gossipEndpoints,
          getServiceEndpoints(modifiedData.gossipEndpoints),
        ),
    );
  });

  test('with serviceEndpoints changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = {
      ...data,
      serviceEndpoints: [
        {
          ipAddressV4: null,
          port: '4343',
          domainName: 'example.com',
        },
      ],
    };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.serviceEndpoints !== null &&
        compareNodeServiceEndpoints(
          t.serviceEndpoints,
          getServiceEndpoints(modifiedData.serviceEndpoints),
        ),
    );
  });

  test('with grpcWebProxyEndpoint changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = {
      ...data,
      grpcWebProxyEndpoint: {
        ipAddressV4: null,
        port: '4343',
        domainName: 'example.com',
      },
    };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.grpcWebProxyEndpoint !== null &&
        compareNodeServiceEndpoint(
          t.grpcWebProxyEndpoint,
          getServiceEndpoint(modifiedData.grpcWebProxyEndpoint)!,
        ),
    );
  });

  test('with gossipCaCertificate changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, gossipCaCertificate: new Uint8Array([6, 7, 8]) };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.gossipCaCertificate !== null &&
        uint8ArrayToHex(t.gossipCaCertificate) ===
          uint8ArrayToHex(modifiedData.gossipCaCertificate),
    ).toBe(true);
  });

  test('with certificateHash changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, certificateHash: new Uint8Array([9, 10, 11]) };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(
      t.certificateHash !== null &&
        uint8ArrayToHex(t.certificateHash) === uint8ArrayToHex(modifiedData.certificateHash),
    ).toBe(true);
  });

  test('with adminKey changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, adminKey: PrivateKey.generateECDSA().publicKey };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(t.adminKey !== null && compareKeys(t.adminKey, modifiedData.adminKey)).toBe(true);
  });

  test('with declineReward changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, declineReward: false };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(t.declineReward).toBe(modifiedData.declineReward);
  });

  test('with associatedRegisteredNodes changed', () => {
    const baseline = createNodeUpdateTransaction(data, null);
    const modifiedData = { ...data, associatedRegisteredNodes: ['3', '4'] };
    const t = createNodeUpdateTransaction(modifiedData, baseline);

    expect(t.associatedRegisteredNodes).toEqual([Long.fromNumber(3), Long.fromNumber(4)]);
  });
});
