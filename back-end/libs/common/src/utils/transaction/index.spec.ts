import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import {
  AccountId,
  AccountCreateTransaction,
  KeyList,
  PrivateKey,
  Transaction as SDKTransaction,
  TransactionId,
} from '@hashgraph/sdk';

import { TransactionSignatureService, flattenKeyList } from '@app/common';

import { keysRequiredToSign, userKeysRequiredToSign } from '.';

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

    const result = await keysRequiredToSign(transaction, transactionSignatureService, entityManager);
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
