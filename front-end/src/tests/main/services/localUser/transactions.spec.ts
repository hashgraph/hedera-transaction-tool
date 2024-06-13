import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import {
  freezeTransaction,
  getClient,
  setClient,
  signTransaction,
} from '@main/services/localUser/transactions';

import * as SDK from '@hashgraph/sdk';
import { getKeyPairs } from '@main/services/localUser/keyPairs';
import { decrypt } from '@main/utils/crypto';
import { KeyPair } from '@prisma/client';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
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
});
