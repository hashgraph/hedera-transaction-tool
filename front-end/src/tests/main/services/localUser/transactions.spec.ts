import { expect, vi } from 'vitest';

import prisma from '@main/db/__mocks__/prisma';

import { setClient } from '@main/services/localUser/transactions';
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

      setClient('testnet');
      expect(forTestnet).toHaveBeenCalledTimes(1);

      setClient('previewnet');
      expect(forPreviewnet).toHaveBeenCalledTimes(1);

      setClient('local-node');
      expect(forLocalNode).toHaveBeenCalledTimes(1);
    });

    test('Should set client for common networks', () => {
      const forMainnet = vi.spyOn(SDK.Client, 'forMainnet');
    });
  });
});
