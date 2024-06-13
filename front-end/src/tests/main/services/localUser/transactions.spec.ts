import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import { freezeTransaction, getClient, setClient } from '@main/services/localUser/transactions';
import * as SDK from '@hashgraph/sdk';

vi.mock('crypto', () => ({ randomUUID: vi.fn() }));
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('@main/db/prisma');
vi.mock('@hashgraph/sdk', async importOriginal => {
  return {
    ...(await importOriginal<typeof import('@hashgraph/sdk')>()),
  };
});

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

    it('should freeze the transaction and return its bytes', async () => {
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
  });
});
