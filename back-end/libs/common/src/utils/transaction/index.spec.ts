import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import { KeyList, AccountCreateTransaction, PrivateKey } from '@hashgraph/sdk';

import {
  isExpired,
  getSignatureEntities,
  getAccountKeysByCondition,
  isPublicKeyInKeyList,
  parseAccountProperty,
  MirrorNodeService,
} from '@app/common';
import { UserKey } from '@entities';

import { keysRequiredToSign, userKeysRequiredToSign } from '.';

jest.mock('@app/common');

describe('keysRequiredToSign', () => {
  let transaction;
  const mirrorNodeService = mockDeep<MirrorNodeService>();
  const entityManager = mockDeep<EntityManager>();

  beforeEach(() => {
    jest.resetAllMocks();

    const accounCreatetTx = new AccountCreateTransaction();
    transaction = { id: 1, transactionBytes: accounCreatetTx.toBytes(), network: 'testnet' };
  });

  it('should return an empty array if transaction is not provided', async () => {
    const result = await keysRequiredToSign(null, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should return an empty array if the transaction is expired', async () => {
    entityManager.find
      .calledWith(UserKey, expect.anything())
      .mockResolvedValueOnce([{ id: 1, publicKey: 'publicKey1' }]);

    jest.mocked(isExpired).mockReturnValueOnce(true);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValue(pk.publicKey);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should not retun user key IDs if user already signed the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([
      {
        userKey: {
          publicKey: pk.publicKey.toStringRaw(),
        },
      },
    ]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([new KeyList([pk.publicKey])]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([new KeyList([pk.publicKey])]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should not add account key if receiver sig is not required', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValue({
      accounts: [],
      receiverAccounts: ['0.0.21213'],
      newKeys: [],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([]);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should not add new key if user key is not in the list', async () => {
    const pk = PrivateKey.generateED25519();

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce([{ id: 1, publicKey: '0x' }]);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: [],
      receiverAccounts: [],
      newKeys: [new KeyList([pk.publicKey])],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(false);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([]);

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

    const accounCreatetTx = new AccountCreateTransaction();
    transaction = { id: 1, transactionBytes: accounCreatetTx.toBytes(), network: 'testnet' };
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

  it('should retun user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([]);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);
    jest.mocked(getAccountKeysByCondition).mockResolvedValueOnce([pk.publicKey]);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([1]);
  });
});
