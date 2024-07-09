import { KeyList, AccountCreateTransaction, PrivateKey } from '@hashgraph/sdk';

import {
  isExpired,
  getSignatureEntities,
  isPublicKeyInKeyList,
  parseAccountProperty,
} from '@app/common';
import { userKeysRequiredToSign } from './transaction.util';

jest.mock('@app/common');

describe('userKeysRequiredToSign', () => {
  let transaction;
  let user;
  let mirrorNodeService;
  let entityManager;

  beforeEach(() => {
    jest.resetAllMocks();

    const accounCreatetTx = new AccountCreateTransaction();
    transaction = { id: 1, body: accounCreatetTx.toBytes(), network: 'testnet' };
    user = { id: 1, keys: [] };
    mirrorNodeService = { getAccountInfo: jest.fn() };
    entityManager = { find: jest.fn() };
  });

  it('should return an empty array if transaction is not provided', async () => {
    const result = await userKeysRequiredToSign(null, user, mirrorNodeService, entityManager);
    expect(result).toEqual([]);
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

  it('should return an empty array if the transaction is expired', async () => {
    user.keys = [{ id: 1, publicKey: 'publicKey1' }];
    entityManager.find.mockResolvedValueOnce(user.keys);

    jest.mocked(isExpired).mockReturnValueOnce(true);

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
    entityManager.find.mockResolvedValueOnce([]);

    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValue(pk.publicKey);
    mirrorNodeService.getAccountInfo.mockResolvedValue({
      key: pk.publicKey.toStringRaw(),
      receiver_sig_required: true,
    });

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([1]);
  });

  it('should return user key IDs required to sign the transaction', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([]);

    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValue(new KeyList([pk.publicKey]));
    mirrorNodeService.getAccountInfo.mockResolvedValue({
      key: new KeyList([pk.publicKey]),
      receiver_sig_required: true,
    });

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([1]);
  });

  it('should not retun user key IDs if user already signed the transaction', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([
      {
        userKey: {
          publicKey: pk.publicKey.toStringRaw(),
        },
      },
    ]);

    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValue(pk.publicKey);
    mirrorNodeService.getAccountInfo.mockResolvedValue({
      key: pk.publicKey.toStringRaw(),
      receiver_sig_required: true,
    });

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });

  it('should not retun user key IDs if user already signed the transaction', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([
      {
        userKey: {
          publicKey: pk.publicKey.toStringRaw(),
        },
      },
    ]);

    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [pk.publicKey],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValue(new KeyList([pk.publicKey]));
    mirrorNodeService.getAccountInfo.mockResolvedValue({
      key: new KeyList([pk.publicKey]),
      receiver_sig_required: true,
    });

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });

  it('should not add account key if it is not found', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([]);

    jest.mocked(getSignatureEntities).mockReturnValue({
      accounts: ['0.0.21212'],
      receiverAccounts: ['0.0.21212'],
      newKeys: [],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    jest.mocked(parseAccountProperty).mockReturnValueOnce(null);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValueOnce(true);
    jest.mocked(parseAccountProperty).mockReturnValueOnce(null);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });

  it('should not add account key if receiver sig is not required', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: pk.publicKey.toStringRaw() }];
    entityManager.find.mockResolvedValueOnce([]);

    jest.mocked(getSignatureEntities).mockReturnValue({
      accounts: [],
      receiverAccounts: ['0.0.21213'],
      newKeys: [],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(true);
    //@ts-expect-error overload typing issue
    jest.mocked(parseAccountProperty).mockReturnValueOnce(false);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });

  it('should not add new key if user key is not in the list', async () => {
    const pk = PrivateKey.generateED25519();

    user.keys = [{ id: 1, publicKey: '0x' }];
    entityManager.find.mockResolvedValueOnce([]);

    jest.mocked(getSignatureEntities).mockReturnValueOnce({
      accounts: [],
      receiverAccounts: [],
      newKeys: [new KeyList([pk.publicKey])],
    });
    jest.mocked(isPublicKeyInKeyList).mockReturnValue(false);

    const result = await userKeysRequiredToSign(
      transaction,
      user,
      mirrorNodeService,
      entityManager,
    );
    expect(result).toEqual([]);
  });
});
