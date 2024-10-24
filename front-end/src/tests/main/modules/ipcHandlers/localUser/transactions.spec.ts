import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerTransactionsHandlers from '@main/modules/ipcHandlers/localUser/transactions';

import { Prisma } from '@prisma/client';
import { Network } from '@main/shared/enums';
import {
  executeQuery,
  executeTransaction,
  getTransactions,
  storeTransaction,
  encodeSpecialFile,
  setClient,
  freezeTransaction,
  signTransaction,
  getTransactionsCount,
  getTransaction,
} from '@main/services/localUser';
import { ipcMain } from 'electron';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  executeQuery: vi.fn(),
  executeTransaction: vi.fn(),
  getTransactions: vi.fn(),
  storeTransaction: vi.fn(),
  encodeSpecialFile: vi.fn(),
  setClient: vi.fn(),
  freezeTransaction: vi.fn(),
  signTransaction: vi.fn(),
  getTransactionsCount: vi.fn(),
  getTransaction: vi.fn(),
}));

describe('IPC handlers Accounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerTransactionsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = [
      'setClient',
      'freezeTransaction',
      'signTransaction',
      'executeTransaction',
      'executeQuery',
      'storeTransaction',
      'getTransactions',
      'getTransaction',
      'getTransactionsCount',
      'encodeSpecialFile',
    ];

    expect(
      events.every(e =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `transactions:${e}`),
      ),
    ).toBe(true);
  });

  test('Should set up setClient handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactions:setClient');
    expect(handler).toBeDefined();

    const mirrorNetwork = ['mainnet'];
    const ledgerId = '0x0';

    handler && (await handler[1](event, mirrorNetwork, ledgerId));
    expect(setClient).toHaveBeenCalledWith(mirrorNetwork, ledgerId);
  });

  test('Should set up freezeTransaction handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactions:freezeTransaction',
    );
    expect(handler).toBeDefined();

    const transactionBytes = new Uint8Array();

    handler && (await handler[1](event, transactionBytes));
    expect(freezeTransaction).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up signTransaction handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactions:signTransaction');
    expect(handler).toBeDefined();

    const transactionBytes = new Uint8Array();
    const publicKeys = ['publicKey'];
    const userId = 'userId';
    const userPassword = 'userPassword';

    handler && (await handler[1](event, transactionBytes, publicKeys, userId, userPassword));
    expect(signTransaction).toHaveBeenCalledWith(
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
    );
  });

  test('Should set up executeTransaction handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactions:executeTransaction',
    );
    expect(handler).toBeDefined();

    const transactionBytes = new Uint8Array();

    handler && (await handler[1](event, transactionBytes));
    expect(executeTransaction).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up executeQuery handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactions:executeQuery');
    expect(handler).toBeDefined();

    const queryBytes = new Uint8Array();
    const accountId = 'accountId';
    const privateKey = 'privateKey';
    const privateKeyType = 'privateKeyType';

    handler && (await handler[1](event, queryBytes, accountId, privateKey, privateKeyType));
    expect(executeQuery).toHaveBeenCalledWith(queryBytes, accountId, privateKey, privateKeyType);
  });

  test('Should set up storeTransaction handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactions:storeTransaction',
    );
    expect(handler).toBeDefined();

    const transaction: Prisma.TransactionUncheckedCreateInput = {
      id: 'transactionId',
      user_id: 'userId',
      name: 'name',
      type: 'type',
      status: 'status',
      description: 'description',
      transaction_id: 'transactionId',
      transaction_hash: 'transactionHash',
      status_code: 20,
      signature: '0x',
      network: Network.PREVIEWNET,
      valid_start: new Date().toLocaleString(),
      executed_at: Date.now(),
      created_at: new Date(),
      body: 'content',
    };

    handler && (await handler[1](event, transaction));
    expect(storeTransaction).toHaveBeenCalledWith(transaction);
  });

  test('Should set up getTransactions handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactions:getTransactions');
    expect(handler).toBeDefined();

    const findArgs: Prisma.TransactionFindManyArgs = {
      where: { user_id: 'userId' },
    };

    handler && (await handler[1](event, findArgs));
    expect(getTransactions).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getTransaction handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactions:getTransaction');
    expect(handler).toBeDefined();

    const id = 'transactionId';

    handler && (await handler[1](event, id));
    expect(getTransaction).toHaveBeenCalledWith(id);
  });

  test('Should set up getTransactionsCount handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactions:getTransactionsCount',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';

    handler && (await handler[1](event, userId));
    expect(getTransactionsCount).toHaveBeenCalledWith(userId);
  });

  test('Should set up encodeSpecialFile handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactions:encodeSpecialFile',
    );
    expect(handler).toBeDefined();

    const content = new Uint8Array();
    const fileId = 'fileId';

    handler && (await handler[1](event, content, fileId));
    expect(encodeSpecialFile).toHaveBeenCalledWith(content, fileId);
  });
});
