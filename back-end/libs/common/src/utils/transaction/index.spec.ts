import { mockDeep } from 'jest-mock-extended';
import { EntityManager, Repository } from 'typeorm';
import {
  AccountId,
  AccountCreateTransaction,
  KeyList,
  PrivateKey,
  Transaction as SDKTransaction,
  TransactionId,
} from '@hiero-ledger/sdk';

import { TransactionSignatureService, flattenKeyList, hasValidSignatureKey, smartCollate } from '@app/common';
import { Transaction, TransactionStatus } from '@entities';

import { keysRequiredToSign, processTransactionStatus, userKeysRequiredToSign } from '.';

jest.mock('@app/common/utils');

describe('keysRequiredToSign', () => {
  let transaction;
  const transactionSignatureService = mockDeep<TransactionSignatureService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(() => {
    jest.resetAllMocks();

    const accountCreateTx = new AccountCreateTransaction()
      .setTransactionId(TransactionId.generate('0.0.2'))
      .setNodeAccountIds([AccountId.fromString('0.0.3')])
      .freeze();
    transaction = { id: 1, transactionBytes: accountCreateTx.toBytes(), network: 'testnet' };
  });

  it('should return an empty array if transaction is not provided', async () => {
    const result = await keysRequiredToSign(null, transactionSignatureService, entityManager);
    expect(result).toEqual([]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);

    entityManager.find.mockResolvedValueOnce(keys);
    transactionSignatureService.computeSignatureKey.mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, transactionSignatureService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should not add the key if it is already in the list', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);
    const signedTransaction = await SDKTransaction.fromBytes(transaction.transactionBytes).freeze().sign(pk);
    transaction.transactionBytes = signedTransaction.toBytes();

    entityManager.find.mockResolvedValueOnce(keys);
    transactionSignatureService.computeSignatureKey.mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, transactionSignatureService, entityManager, { excludeAlreadySigned: true });
    expect(result).toEqual([]);
  });
});

describe('userKeysRequiredToSign', () => {
  let transaction;
  let user;
  let entityManager;
  const transactionSignatureService = mockDeep<TransactionSignatureService>();

  beforeEach(() => {
    jest.resetAllMocks();

    const accountCreateTx = new AccountCreateTransaction();
    transaction = { id: 1, transactionBytes: accountCreateTx.toBytes(), network: 'testnet' };
    user = { id: 1, keys: [] };
    entityManager = { find: jest.fn() };
  });

  it('should return an empty array if user has no keys and none are found', async () => {
    entityManager.find.mockResolvedValueOnce([]);
    const result = await userKeysRequiredToSign(
      transaction,
      user,
      transactionSignatureService,
      entityManager,
      false,
    );
    expect(result).toEqual([]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);

    entityManager.find.mockResolvedValueOnce([]);
    transactionSignatureService.computeSignatureKey.mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      transactionSignatureService,
      entityManager,
      false,
    );
    expect(result).toEqual([1]);
  });
});

describe('processTransactionStatus', () => {
  const transactionSignatureService = mockDeep<TransactionSignatureService>();
  const transactionRepo = mockDeep<Repository<Transaction>>();

  const makeTransaction = (id: number, status: TransactionStatus): Transaction => ({
    id,
    status,
    transactionBytes: new AccountCreateTransaction().toBytes() as Buffer,
  } as unknown as Transaction);

  const setupQueryBuilder = () => {
    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ raw: [] }),
    };
    transactionRepo.createQueryBuilder.mockReturnValue(qb as any);
    return qb;
  };

  beforeEach(() => {
    jest.resetAllMocks();
    setupQueryBuilder();
  });

  it('skips a transaction and does not change its status when computeSignatureKey throws', async () => {
    const transaction = makeTransaction(1, TransactionStatus.WAITING_FOR_SIGNATURES);
    transactionSignatureService.computeSignatureKey.mockRejectedValue(new Error('mirror node down'));

    const result = await processTransactionStatus(transactionRepo, transactionSignatureService, [transaction]);

    expect(result.size).toBe(0);
    expect(transactionRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('processes other transactions when one has a key resolution failure', async () => {
    const failing = makeTransaction(1, TransactionStatus.WAITING_FOR_SIGNATURES);
    const succeeding = makeTransaction(2, TransactionStatus.WAITING_FOR_SIGNATURES);

    transactionSignatureService.computeSignatureKey
      .mockRejectedValueOnce(new Error('mirror node down'))
      .mockResolvedValueOnce(new KeyList());

    jest.mocked(hasValidSignatureKey).mockReturnValue(true);
    jest.mocked(smartCollate).mockResolvedValue({} as SDKTransaction);

    const qb = setupQueryBuilder();
    qb.execute.mockResolvedValue({ raw: [{ id: 2 }] });

    const result = await processTransactionStatus(transactionRepo, transactionSignatureService, [failing, succeeding]);

    // Only the succeeding transaction should have a status change
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
  });
});
