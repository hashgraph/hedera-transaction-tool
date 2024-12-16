import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import { Prisma } from '@prisma/client';

import registerKeyPairsHandlers from '@main/modules/ipcHandlers/localUser/keyPairs';
import {
  storeKeyPair,
  deleteSecretHashes,
  changeDecryptionPassword,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
  getKeyPairs,
  getSecretHashes,
  deleteKeyPair,
  updateNickname,
  updateMnemonicHash,
} from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers Key Pairs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerKeyPairsHandlers();
  });

  const userId = 'userId';
  const password = 'password';
  const oldPassword = 'oldPassword';
  const newPassword = 'newPassword';
  const organizationId = 'organizationId';
  const keyPairId = 'keyPairId';
  const nickname = 'nickname';
  const mnemonicHash = 'mnemonicHash';

  test('Should register handlers for each event', () => {
    const events = [
      'store',
      'getAll',
      'getSecretHashes',
      'changeDecryptionPassword',
      'updateNickname',
      'updateMnemonicHash',
      'deleteEncryptedPrivateKeys',
      'deleteKeyPair',
      'decryptPrivateKey',
      'clear',
    ];
    expect(events.every(util => getIPCHandler(`keyPairs:${util}`))).toBe(true);
  });

  test('Should set up store key pair handler', async () => {
    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      public_key: 'publicKey',
      private_key: 'privateKey',
      user_id: 'userId',
      type: 'type',
      index: 1,
    };
    const encrypted = true;

    await invokeIPCHandler('keyPairs:store', keyPair, password, encrypted);
    expect(storeKeyPair).toHaveBeenCalledWith(keyPair, password, encrypted);
  });

  test('Should set up changeDecryptionPassword handler', async () => {
    await invokeIPCHandler('keyPairs:changeDecryptionPassword', userId, oldPassword, newPassword);
    expect(changeDecryptionPassword).toHaveBeenCalledWith(userId, oldPassword, newPassword);
  });

  test('Should set up decryptPrivateKey handler', async () => {
    const publicKey = 'publicKey';

    await invokeIPCHandler('keyPairs:decryptPrivateKey', userId, password, publicKey);
    expect(decryptPrivateKey).toHaveBeenCalledWith(userId, password, publicKey);
  });

  test('Should set up getAll handler', async () => {
    await invokeIPCHandler('keyPairs:getAll', userId, organizationId);
    expect(getKeyPairs).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up getSecretHashes handler', async () => {
    await invokeIPCHandler('keyPairs:getSecretHashes', userId, organizationId);
    expect(getSecretHashes).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up deleteEncryptedPrivateKeys handler', async () => {
    await invokeIPCHandler('keyPairs:deleteEncryptedPrivateKeys', userId, organizationId);
    expect(deleteEncryptedPrivateKeys).toHaveBeenCalledWith(userId, organizationId);
  });

  test('Should set up deleteKeyPair handler', async () => {
    await invokeIPCHandler('keyPairs:deleteKeyPair', keyPairId);
    expect(deleteKeyPair).toHaveBeenCalledWith(keyPairId);
  });

  test('Should set up clear handler', async () => {
    await invokeIPCHandler('keyPairs:clear', userId, organizationId);
    expect(deleteSecretHashes).toHaveBeenCalledWith(userId, organizationId);

    vi.mocked(deleteSecretHashes).mockRejectedValueOnce(new Error('Error'));
    const result = await invokeIPCHandler('keyPairs:clear', userId, organizationId);
    expect(result).toBe(false);
  });

  test('Should set up updateNickname handler', async () => {
    await invokeIPCHandler('keyPairs:updateNickname', keyPairId, nickname);
    expect(updateNickname).toHaveBeenCalledWith(keyPairId, nickname);
  });

  test('Should set up updateMnemonicHash handler', async () => {
    await invokeIPCHandler('keyPairs:updateMnemonicHash', keyPairId, mnemonicHash);
    expect(updateMnemonicHash).toHaveBeenCalledWith(keyPairId, mnemonicHash);
  });
});
