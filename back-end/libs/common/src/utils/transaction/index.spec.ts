import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import { KeyList, AccountCreateTransaction, PrivateKey } from '@hashgraph/sdk';

import { MirrorNodeService, computeSignatureKey, flattenKeyList } from '@app/common';

import { keysRequiredToSign, userKeysRequiredToSign } from '.';

jest.mock('@app/common');

describe('keysRequiredToSign', () => {
  let transaction;
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(() => {
    jest.resetAllMocks();

    const accountCreateTx = new AccountCreateTransaction();
    transaction = { id: 1, transactionBytes: accountCreateTx.toBytes(), network: 'testnet' };
  });

  it('should return an empty array if transaction is not provided', async () => {
    const result = await keysRequiredToSign(null, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(computeSignatureKey).mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should not add the key if it is already in the list', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);

    entityManager.find.mockResolvedValueOnce([
      { userKey: { id: 1, publicKey: pk.publicKey.toStringRaw() } },
    ]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(computeSignatureKey).mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });
});

describe('userKeysRequiredToSign', () => {
  let transaction;
  let user;
  let mirrorNodeService;
  let entityManager;

  beforeEach(() => {
    jest.resetAllMocks();

    const accountCreateTx = new AccountCreateTransaction();
    transaction = { id: 1, transactionBytes: accountCreateTx.toBytes(), network: 'testnet' };
    user = { id: 1, keys: [] };
    mirrorNodeService = { getAccountInfo: jest.fn() };
    entityManager = { find: jest.fn() };
  });

  it('should return an empty array if user has no keys and none are found', async () => {
    entityManager.find.mockResolvedValueOnce([]);
    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    const keyList = new KeyList([pk.publicKey]);

    entityManager.find.mockResolvedValueOnce([]);
    jest.mocked(computeSignatureKey).mockResolvedValueOnce(keyList);
    jest.mocked(flattenKeyList).mockReturnValueOnce([pk.publicKey]);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([1]);
  });
});
