import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerTransactionsHandlers from '@main/modules/ipcHandlers/localUser/transactions';

import { Prisma } from '@prisma/client';
import { CommonNetwork } from '@main/shared/enums';
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

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers Accounts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerTransactionsHandlers();
  });

  const userId = 'userId';
  const fileId = 'fileId';
  const transactionId = 'transactionId';
  const userPassword = 'userPassword';

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
    expect(events.every(e => getIPCHandler(`transactions:${e}`))).toBe(true);
  });

  test('Should set up setClient handler', async () => {
    const mirrorNetwork = ['mainnet'];
    const ledgerId = '0x0';

    await invokeIPCHandler('transactions:setClient', mirrorNetwork, ledgerId);
    expect(setClient).toHaveBeenCalledWith(mirrorNetwork, ledgerId);
  });

  test('Should set up freezeTransaction handler', async () => {
    const transactionBytes = new Uint8Array();

    await invokeIPCHandler('transactions:freezeTransaction', transactionBytes);
    expect(freezeTransaction).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up signTransaction handler', async () => {
    const transactionBytes = new Uint8Array();
    const publicKeys = ['publicKey'];

    await invokeIPCHandler(
      'transactions:signTransaction',
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
    );
    expect(signTransaction).toHaveBeenCalledWith(
      transactionBytes,
      publicKeys,
      userId,
      userPassword,
    );
  });

  test('Should set up executeTransaction handler', async () => {
    const transactionBytes = new Uint8Array();

    await invokeIPCHandler('transactions:executeTransaction', transactionBytes);
    expect(executeTransaction).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up executeQuery handler', async () => {
    const queryBytes = new Uint8Array();
    const accountId = 'accountId';
    const privateKey = 'privateKey';
    const privateKeyType = 'privateKeyType';

    await invokeIPCHandler(
      'transactions:executeQuery',
      queryBytes,
      accountId,
      privateKey,
      privateKeyType,
    );
    expect(executeQuery).toHaveBeenCalledWith(queryBytes, accountId, privateKey, privateKeyType);
  });

  test('Should set up storeTransaction handler', async () => {
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
      network: CommonNetwork.PREVIEWNET,
      valid_start: new Date().toLocaleString(),
      executed_at: Date.now(),
      created_at: new Date(),
      body: 'content',
    };

    await invokeIPCHandler('transactions:storeTransaction', transaction);
    expect(storeTransaction).toHaveBeenCalledWith(transaction);
  });

  test('Should set up getTransactions handler', async () => {
    const findArgs: Prisma.TransactionFindManyArgs = {
      where: { user_id: 'userId' },
    };

    await invokeIPCHandler('transactions:getTransactions', findArgs);
    expect(getTransactions).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getTransaction handler', async () => {
    await invokeIPCHandler('transactions:getTransaction', transactionId);
    expect(getTransaction).toHaveBeenCalledWith(transactionId);
  });

  test('Should set up getTransactionsCount handler', async () => {
    await invokeIPCHandler('transactions:getTransactionsCount', userId);
    expect(getTransactionsCount).toHaveBeenCalledWith(userId);
  });

  test('Should set up encodeSpecialFile handler', async () => {
    const content = new Uint8Array();

    await invokeIPCHandler('transactions:encodeSpecialFile', content, fileId);
    expect(encodeSpecialFile).toHaveBeenCalledWith(content, fileId);
  });
});
