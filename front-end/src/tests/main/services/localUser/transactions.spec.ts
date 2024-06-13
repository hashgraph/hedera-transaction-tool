import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  executeQuery,
  executeTransaction,
  freezeTransaction,
  getClient,
  setClient,
  signTransaction,
  storeTransaction,
} from '@main/services/localUser/transactions';

import * as SDK from '@hashgraph/sdk';
import { getKeyPairs } from '@main/services/localUser/keyPairs';
import { decrypt } from '@main/utils/crypto';
import { getNumberArrayFromString } from '@main/utils';
import { getStatusCodeFromMessage } from '@main/utils/sdk';
import { KeyPair, Prisma } from '@prisma/client';
import { app, shell } from 'electron';
import { decodeProto, isHederaSpecialFileId } from '@main/utils/hederaSpecialFiles';
import * as path from 'path';
import fs from 'fs/promises';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
vi.mock('electron', () => ({ app: { getPath: vi.fn() }, shell: { showItemInFolder: vi.fn() } }));
vi.mock('@hashgraph/sdk', async importOriginal => {
  return {
    ...(await importOriginal<typeof import('@hashgraph/sdk')>()),
  };
});
vi.mock('@main/services/localUser/keyPairs', () => ({
  getKeyPairs: vi.fn(),
}));
vi.mock('@main/utils/crypto', () => ({
  decrypt: vi.fn(),
}));
vi.mock('@main/utils/sdk', () => ({
  getStatusCodeFromMessage: vi.fn(),
}));
vi.mock('fs/promises', () => ({ default: { writeFile: vi.fn() } }));
vi.mock('@main/utils/hederaSpecialFiles', () => ({
  decodeProto: vi.fn(),
  isHederaSpecialFileId: vi.fn(),
}));
vi.mock('@main/utils', () => ({
  getNumberArrayFromString: vi.fn(),
}));

describe('Services Local User Transactions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('setClient', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should set client for common networks', () => {
      const forMainnet = vi.spyOn(SDK.Client, 'forMainnet');
      const forTestnet = vi.spyOn(SDK.Client, 'forMainnet');
      const forPreviewnet = vi.spyOn(SDK.Client, 'forMainnet');
      const forLocalNode = vi.spyOn(SDK.Client, 'forMainnet');

      setClient('mainnet');
      expect(forMainnet).toHaveBeenCalledTimes(1);
      getClient().close();

      setClient('testnet');
      expect(forTestnet).toHaveBeenCalledTimes(1);
      getClient().close();

      setClient('previewnet');
      expect(forPreviewnet).toHaveBeenCalledTimes(1);
      getClient().close();

      setClient('local-node');
      expect(forLocalNode).toHaveBeenCalledTimes(1);
      getClient().close();
    });

    test('Should set client for custom network', () => {
      const nodeAddress = { '0.0.3': 'http://my-test-url.com' };

      const forNetwork = vi.spyOn(SDK.Client, 'forNetwork');

      try {
        setClient('custom', nodeAddress, ['testnet']);
        getClient().close();
      } catch (error) {
        /* Ignore error */
      }

      expect(forNetwork).toHaveBeenCalledWith(nodeAddress);
    });

    test('Should throw error when setting custom network without node addresses or mirror network', () => {
      expect(() => setClient('custom', undefined, ['testnet'])).toThrowError(
        'Settings for custom network are required',
      );

      expect(() => setClient('custom', { '0.0.3': 'url' })).toThrowError(
        'Settings for custom network are required',
      );
    });

    test('Should throw error when setting custom network without node addresses or mirror network', () => {
      expect(() => setClient('some-cool-network')).toThrowError('Network not supported');
    });
  });

  describe('getClient', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return client', () => {
      setClient('testnet');

      expect(getClient()).toBeDefined();
    });
  });

  describe('freezeTransaction', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should freeze the transaction and return its bytes', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const frozenTransactionBytes = new Uint8Array([4, 5, 6]);

      const transactionMock = {
        freezeWith: vi.fn(),
        toBytes: vi.fn().mockReturnValue(frozenTransactionBytes),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );

      const result = await freezeTransaction(transactionBytes);

      expect(SDK.Transaction.fromBytes).toHaveBeenCalledWith(transactionBytes);
      expect(transactionMock.freezeWith).toHaveBeenCalled();
      expect(transactionMock.toBytes).toHaveBeenCalled();
      expect(result).toEqual(frozenTransactionBytes);
    });
  });

  describe('signTransaction', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should sign the transaction with the private keys and return its bytes', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const signedTransactionBytes = new Uint8Array([4, 5, 6]);
      const publicKeys = ['publicKey1', 'publicKey2'];
      const userId = 'user1';
      const userPassword = 'password1';
      const keyPairs = [
        { public_key: 'publicKey1', private_key: 'privateKey1', type: 'ECDSA' },
        { public_key: 'publicKey2', private_key: 'privateKey2', type: 'ED25519' },
      ];
      const decryptedPrivateKeys = ['decryptedPrivateKey1', 'decryptedPrivateKey2'];

      const transactionMock = {
        freezeWith: vi.fn(),
        sign: vi.fn(),
        toBytes: vi.fn().mockReturnValue(signedTransactionBytes),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );
      vi.spyOn(SDK.PrivateKey, 'fromStringECDSA').mockImplementation(
        () => 'ECDSA' as unknown as SDK.PrivateKey,
      );
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockImplementation(
        () => 'ED25519' as unknown as SDK.PrivateKey,
      );
      vi.mocked(getKeyPairs).mockResolvedValue(keyPairs as unknown as KeyPair[]);
      vi.mocked(decrypt).mockImplementation((privateKey, password) => {
        expect(password).toBe(userPassword);
        return decryptedPrivateKeys[keyPairs.findIndex(kp => kp.private_key === privateKey)];
      });

      const result = await signTransaction(transactionBytes, publicKeys, userId, userPassword);

      expect(SDK.Transaction.fromBytes).toHaveBeenCalledWith(transactionBytes);
      expect(transactionMock.freezeWith).toHaveBeenCalled();
      expect(getKeyPairs).toHaveBeenCalledWith(userId);
      keyPairs.forEach((kp, i) => {
        expect(decrypt).toHaveBeenCalledWith(kp.private_key, userPassword);
        if (kp.type === 'ECDSA') {
          expect(SDK.PrivateKey.fromStringECDSA).toHaveBeenCalledWith(
            `0x${decryptedPrivateKeys[i]}`,
          );
        } else {
          expect(SDK.PrivateKey.fromStringED25519).toHaveBeenCalledWith(decryptedPrivateKeys[i]);
        }
        expect(transactionMock.sign).toHaveBeenCalledWith(expect.anything());
      });
      expect(transactionMock.toBytes).toHaveBeenCalled();
      expect(result).toEqual(signedTransactionBytes);
    });

    test('Should throw if public key not found in user keys', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const signedTransactionBytes = new Uint8Array([4, 5, 6]);
      const publicKeys = ['publicKey1', 'differentKey'];
      const userId = 'user1';
      const userPassword = 'password1';
      const keyPairs = [
        { public_key: 'publicKey1', private_key: 'privateKey1', type: 'ECDSA' },
        { public_key: 'publicKey2', private_key: 'privateKey2', type: 'ED25519' },
      ];
      const decryptedPrivateKeys = ['decryptedPrivateKey1', 'decryptedPrivateKey2'];

      const transactionMock = {
        freezeWith: vi.fn(),
        sign: vi.fn(),
        toBytes: vi.fn().mockReturnValue(signedTransactionBytes),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );
      vi.spyOn(SDK.PrivateKey, 'fromStringECDSA').mockImplementation(
        () => 'ECDSA' as unknown as SDK.PrivateKey,
      );
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockImplementation(
        () => 'ED25519' as unknown as SDK.PrivateKey,
      );
      vi.mocked(getKeyPairs).mockResolvedValue(keyPairs as unknown as KeyPair[]);
      vi.mocked(decrypt).mockImplementation((privateKey, password) => {
        expect(password).toBe(userPassword);
        return decryptedPrivateKeys[keyPairs.findIndex(kp => kp.private_key === privateKey)];
      });

      expect(() =>
        signTransaction(transactionBytes, publicKeys, userId, userPassword),
      ).rejects.toThrow('Required public key not found in local key pairs');
    });
  });

  describe('executeTransaction', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should execute the transaction and return the response and receipt', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const responseJSON = '{"response":"data"}';
      const receiptBytes = new Uint8Array([4, 5, 6]);

      const responseMock = {
        getReceipt: vi.fn().mockResolvedValue({ toBytes: vi.fn().mockReturnValue(receiptBytes) }),
        toJSON: vi.fn().mockReturnValue(JSON.parse(responseJSON)),
      };

      const transactionMock = {
        execute: vi.fn().mockResolvedValue(responseMock),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );

      const result = await executeTransaction(transactionBytes);

      expect(SDK.Transaction.fromBytes).toHaveBeenCalledWith(transactionBytes);
      expect(transactionMock.execute).toHaveBeenCalled();
      expect(responseMock.getReceipt).toHaveBeenCalled();
      expect(responseMock.toJSON).toHaveBeenCalled();
      expect(result).toStrictEqual({ responseJSON, receiptBytes });
    });

    test('Should throw an error if the transaction execution fails', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const errorMessage = 'Execution failed';
      const errorStatus = 22;

      const transactionMock = {
        execute: vi
          .fn()
          .mockRejectedValue({ message: errorMessage, status: { _code: errorStatus } }),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );

      await expect(executeTransaction(transactionBytes)).rejects.toThrow(
        JSON.stringify({ status: errorStatus, message: errorMessage }),
      );

      expect(SDK.Transaction.fromBytes).toHaveBeenCalledWith(transactionBytes);
      expect(transactionMock.execute).toHaveBeenCalled();
    });

    test('Should throw an error with status from getStatusCodeFromMessage if error.status is not defined', async () => {
      const transactionBytes = new Uint8Array([1, 2, 3]);
      const errorMessage = 'Execution failed';
      const errorStatus = 21;

      const transactionMock = {
        execute: vi.fn().mockRejectedValue(new Error(errorMessage)),
      };

      vi.spyOn(SDK.Transaction, 'fromBytes').mockReturnValue(
        transactionMock as unknown as SDK.Transaction,
      );
      vi.mocked(getStatusCodeFromMessage).mockReturnValue(errorStatus);

      await expect(executeTransaction(transactionBytes)).rejects.toThrow(
        JSON.stringify({ status: errorStatus, message: errorMessage }),
      );

      expect(SDK.Transaction.fromBytes).toHaveBeenCalledWith(transactionBytes);
      expect(transactionMock.execute).toHaveBeenCalled();
      expect(getStatusCodeFromMessage).toHaveBeenCalledWith(errorMessage);
    });
  });

  describe('executeQuery', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should execute the query and return the response', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'ED25519';
      const response = 'response data';

      const queryMock = {
        execute: vi.fn().mockResolvedValue(response),
      };

      vi.spyOn(SDK.Query, 'fromBytes').mockReturnValue(queryMock as unknown as SDK.Query<any>);
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockReturnValue(
        privateKey as unknown as SDK.PrivateKey,
      );
      const result = await executeQuery(queryBytes, accountId, privateKey, privateKeyType);

      expect(SDK.PrivateKey.fromStringED25519).toHaveBeenCalledWith(privateKey);
      expect(SDK.Query.fromBytes).toHaveBeenCalledWith(queryBytes);
      expect(queryMock.execute).toHaveBeenCalledWith(getClient());
      expect(result).toEqual(response);
    });

    test('Should write response to file and show in folder if response is a large buffer', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'ED25519';
      const response = Buffer.from(new Array(1000002).join('a'), 'utf-8');
      const queryMock = new SDK.FileContentsQuery().setFileId(accountId);
      queryMock.execute = vi.fn().mockResolvedValue(response);

      vi.spyOn(SDK.Query, 'fromBytes').mockReturnValue(queryMock as unknown as SDK.Query<any>);
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockReturnValue(
        privateKey as unknown as SDK.PrivateKey,
      );
      vi.mocked(app.getPath).mockReturnValue('/temp');

      await executeQuery(queryBytes, accountId, privateKey, privateKeyType);

      expect(fs.writeFile).toHaveBeenCalledWith(path.join('/temp', `${accountId}.txt`), response);
      expect(shell.showItemInFolder).toHaveBeenCalledWith(path.join('/temp', `${accountId}.txt`));
    });

    test('Should decode response if query is FileContentsQuery and file is a special file', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const fileId = '0.0.111';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'ECDSA';
      const response = new Uint8Array([4, 5, 6]);

      const queryMock = new SDK.FileContentsQuery().setFileId(fileId);
      queryMock.execute = vi.fn().mockResolvedValue(response);

      vi.spyOn(SDK.Query, 'fromBytes').mockReturnValue(queryMock);
      vi.spyOn(SDK.PrivateKey, 'fromStringECDSA').mockReturnValue(
        privateKey as unknown as SDK.PrivateKey,
      );
      vi.mocked(isHederaSpecialFileId).mockReturnValue(true);
      vi.mocked(decodeProto).mockReturnValue('decoded response');

      const result = await executeQuery(queryBytes, accountId, privateKey, privateKeyType);

      expect(isHederaSpecialFileId).toHaveBeenCalledWith(fileId);
      expect(decodeProto).toHaveBeenCalledWith(fileId, response);
      expect(result).toEqual('decoded response');
    });

    test('Should return bytes if response is an object with a toBytes method', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'ED25519';
      const response = {
        toBytes: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
      };

      const queryMock = {
        execute: vi.fn().mockResolvedValue(response),
      };

      vi.spyOn(SDK.Query, 'fromBytes').mockReturnValue(queryMock as unknown as SDK.Query<any>);
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockReturnValue(
        privateKey as unknown as SDK.PrivateKey,
      );

      const result = await executeQuery(queryBytes, accountId, privateKey, privateKeyType);

      expect(response.toBytes).toHaveBeenCalled();
      expect(result).toEqual(new Uint8Array([4, 5, 6]));
    });

    test('Should re-throw error with the message', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'ED25519';
      const errorMessage = 'Error message';

      const queryMock = {
        execute: vi.fn().mockImplementation(() => {
          throw new Error(errorMessage);
        }),
      };

      vi.spyOn(SDK.Query, 'fromBytes').mockReturnValue(queryMock as unknown as SDK.Query<any>);
      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockReturnValue(
        privateKey as unknown as SDK.PrivateKey,
      );

      expect(() => executeQuery(queryBytes, accountId, privateKey, privateKeyType)).rejects.toThrow(
        errorMessage,
      );
    });

    test('Should throw if typedPrivateKey is null or undefined', async () => {
      const queryBytes = new Uint8Array([1, 2, 3]);
      const accountId = '0.0.1234';
      const privateKey = '302e020100300506032b657004220420';
      const privateKeyType = 'INVALID';

      vi.spyOn(SDK.PrivateKey, 'fromStringED25519').mockReturnValue(
        null as unknown as SDK.PrivateKey,
      );
      vi.spyOn(SDK.PrivateKey, 'fromStringECDSA').mockReturnValue(
        null as unknown as SDK.PrivateKey,
      );

      await expect(executeQuery(queryBytes, accountId, privateKey, privateKeyType)).rejects.toThrow(
        'Invalid key type',
      );

      expect(SDK.PrivateKey.fromStringED25519).not.toHaveBeenCalledOnce();
      expect(SDK.PrivateKey.fromStringECDSA).not.toHaveBeenCalledOnce();
    });
  });

  describe('storeTransaction', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('Should store transaction', async () => {
      const transaction = {
        transaction_hash: '123',
        body: '456',
      };

      vi.mocked(getNumberArrayFromString)
        .mockReturnValueOnce([1, 2, 3])
        .mockReturnValueOnce([4, 5, 6]);

      await storeTransaction(transaction as Prisma.TransactionUncheckedCreateInput);

      expect(getNumberArrayFromString).toHaveBeenCalledWith('123');
      expect(getNumberArrayFromString).toHaveBeenCalledWith('456');
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          ...transaction,
          transaction_hash: Buffer.from(Uint8Array.from([1, 2, 3])).toString('hex'),
          body: Buffer.from(Uint8Array.from([4, 5, 6])).toString('hex'),
        },
      });
    });

    it('Should throw if storing transaction fails', async () => {
      vi.mocked(getNumberArrayFromString).mockImplementation(() => {
        throw new Error('Failed to store transaction');
      });

      expect(
        async () => await storeTransaction({} as Prisma.TransactionUncheckedCreateInput),
      ).rejects.toThrow('Failed to store transaction');
    });
  });
});
