import type { IAccountInfoParsed, INodeInfoParsed } from 'lib';

import { mockDeep } from 'jest-mock-extended';
import { EntityManager } from 'typeorm';
import { KeyList, AccountCreateTransaction, PrivateKey, AccountId } from '@hashgraph/sdk';

import {
  getSignatureEntities,
  isPublicKeyInKeyList,
  MirrorNodeService,
  parseAccountInfo,
  parseNodeInfo,
  transactionIs,
} from '@app/common';

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

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseAccountInfo)
      .mockReturnValueOnce({ key: pk.publicKey } as unknown as IAccountInfoParsed);
    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: pk.publicKey,
      receiverSignatureRequired: true,
    } as unknown as IAccountInfoParsed);

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
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseAccountInfo)
      .mockReturnValueOnce({ key: pk.publicKey } as unknown as IAccountInfoParsed);
    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: pk.publicKey,
      receiverSignatureRequired: true,
    } as unknown as IAccountInfoParsed);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should add the admin key of the node id', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
      nodeId: 2,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseNodeInfo)
      .mockReturnValueOnce({ admin_key: pk.publicKey } as unknown as INodeInfoParsed);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual(keys);
  });

  it('should not add the admin key of the node id if it is already in the list', async () => {
    const pk = PrivateKey.generateED25519();
    const keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];

    entityManager.find.mockResolvedValueOnce([
      { userKey: { publicKey: pk.publicKey.toStringRaw() } },
    ]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
      nodeId: 2,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseNodeInfo)
      .mockReturnValueOnce({ admin_key: pk.publicKey } as unknown as INodeInfoParsed);

    const result = await keysRequiredToSign(transaction, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
  });

  it('should add the key of the new node account id', async () => {
    const pk = PrivateKey.generateED25519();
    const accKey = PrivateKey.generateED25519();
    const keys = [
      { id: 1, publicKey: pk.publicKey.toStringRaw() },
      { id: 2, publicKey: accKey.publicKey.toStringRaw() },
    ];

    entityManager.find.mockResolvedValueOnce([]);
    entityManager.find.mockResolvedValueOnce(keys);
    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: [],
      receiverAccounts: [],
      newKeys: [],
      nodeId: 2,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(parseNodeInfo).mockReturnValueOnce({
      admin_key: pk.publicKey,
      node_account_id: AccountId.fromString('0.0.21212'),
    } as unknown as INodeInfoParsed);
    jest.mocked(transactionIs).mockReturnValueOnce(true);
    jest
      .mocked(parseAccountInfo)
      .mockReturnValueOnce({ key: accKey.publicKey } as unknown as IAccountInfoParsed);

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
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseAccountInfo)
      .mockReturnValueOnce({ key: new KeyList([pk.publicKey]) } as unknown as IAccountInfoParsed);
    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: new KeyList([pk.publicKey]),
      receiverSignatureRequired: true,
    } as unknown as IAccountInfoParsed);

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
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);

    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: new KeyList([pk.publicKey]),
      receiverSignatureRequired: false,
    } as unknown as IAccountInfoParsed);

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
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(false);

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
      nodeId: null,
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest
      .mocked(parseAccountInfo)
      .mockReturnValueOnce({ key: new KeyList([pk.publicKey]) } as unknown as IAccountInfoParsed);
    jest.mocked(parseAccountInfo).mockReturnValueOnce({
      key: new KeyList([pk.publicKey]),
      receiverSignatureRequired: true,
    } as unknown as IAccountInfoParsed);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([1]);
  });
});
