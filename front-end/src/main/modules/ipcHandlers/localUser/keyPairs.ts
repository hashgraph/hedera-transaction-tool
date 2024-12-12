import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

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

const createChannelName = (...props) => ['keyPairs', ...props].join(':');

export default () => {
  // Store key pair
  ipcMain.handle(
    createChannelName('store'),
    async (
      _e,
      keyPair: Prisma.KeyPairUncheckedCreateInput,
      password: string | null,
      encrypted: boolean,
    ) => storeKeyPair(keyPair, password, encrypted),
  );

  // Change Decryption Password
  ipcMain.handle(
    createChannelName('changeDecryptionPassword'),
    (_e, userId: string, oldPassword: string, newPassword: string) =>
      changeDecryptionPassword(userId, oldPassword, newPassword),
  );

  // Decrypted private key
  ipcMain.handle(
    createChannelName('decryptPrivateKey'),
    async (_e, userId: string, password: string | null, publicKey: string) =>
      decryptPrivateKey(userId, password, publicKey),
  );

  // Get stored stored key pairs
  ipcMain.handle(
    createChannelName('getAll'),
    async (_e, userId: string, organizationId?: string | null) =>
      getKeyPairs(userId, organizationId),
  );

  // Get stored keys' secret hashes
  ipcMain.handle(
    createChannelName('getSecretHashes'),
    async (_e, userId: string, organizationId?: string | null) =>
      getSecretHashes(userId, organizationId),
  );

  // Delete encrypted private keys
  ipcMain.handle(
    createChannelName('deleteEncryptedPrivateKeys'),
    async (_e, userId: string, organizationId: string) =>
      deleteEncryptedPrivateKeys(userId, organizationId),
  );

  // Clear keys file
  ipcMain.handle(
    createChannelName('clear'),
    async (_e, userId: string, organizationId?: string) => {
      try {
        await deleteSecretHashes(userId, organizationId);
        return true;
      } catch {
        return false;
      }
    },
  );

  // Delete key pair
  ipcMain.handle(createChannelName('deleteKeyPair'), async (_e, keyPairId: string) =>
    deleteKeyPair(keyPairId),
  );

  // Update key pair nickname
  ipcMain.handle(
    createChannelName('updateNickname'),
    async (_e, keyPairId: string, nickname: string) => {
      await updateNickname(keyPairId, nickname);
    },
  );

  // Update key pair mnemonic hash
  ipcMain.handle(
    createChannelName('updateMnemonicHash'),
    async (_e, keyPairId: string, mnemonicHash: string) => {
      await updateMnemonicHash(keyPairId, mnemonicHash);
    },
  );
};
