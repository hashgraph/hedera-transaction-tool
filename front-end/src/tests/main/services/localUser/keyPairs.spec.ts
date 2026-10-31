import { expect, vi } from 'vitest';

import { safeStorage } from 'electron';

import { KeyPair, Prisma } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  prepareKeyPairsReencryption,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
  deleteKeyPair,
  deleteSecretHashes,
  getKeyPairs,
  storeKeyPair,
  updateMnemonicHash,
  updateNickname,
  updateIndex,
} from '@main/services/localUser/keyPairs';
import { getOrganization } from '@main/services/localUser/organizations';
import { getCurrentUser } from '@main/services/localUser/organizationCredentials';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

import { decrypt, encrypt, isLegacyBlob } from '@main/utils/crypto';

vi.mock('@main/db/prisma');
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  safeStorage: {
    encryptString: vi.fn(),
    decryptString: vi.fn(),
  },
}));
vi.mock('@main/services/localUser/organizations', () => ({ getOrganization: vi.fn() }));
vi.mock('@main/services/localUser/organizationCredentials', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@main/services/localUser/claim', () => ({ getUseKeychainClaim: vi.fn() }));
vi.mock('@main/utils/crypto', () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  isLegacyBlob: vi.fn().mockReturnValue(false),
}));

describe('Services Local User Key Pairs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const keyPair: KeyPair = {
    id: '1',
    user_id: '123',
    organization_id: '321',
    organization_user_id: 1,
    secret_hash: 'hash1',
    private_key: 'private',
    public_key: 'public',
    index: 1,
    nickname: 'nickname',
    type: 'ecdsa',
  };

  describe('getKeyPairs', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('getKeyPairs should retrieve the key pairs for the user', async () => {
      prisma.keyPair.findMany.mockResolvedValue([keyPair]);

      const result = await getKeyPairs(keyPair.user_id, keyPair.organization_id, null);

      expect(result).toEqual([keyPair]);
    });
  });

  describe('storeKeyPair', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should store the key pair with password encryption', async () => {
      prisma.keyPair.create.mockResolvedValue(keyPair);
      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);

      const password = 'password';
      const encrypted = false;

      vi.mocked(encrypt).mockReturnValue(Promise.resolve('encrypted'));

      await storeKeyPair(keyPair, password, encrypted);


      expect(prisma.keyPair.create).toHaveBeenCalledWith({
        data: {
          ...keyPair,
          private_key: 'encrypted',
        },
      });
    });

    test('Should store the key pair with keychain encryption', async () => {
      const encryptedPrivateKey = Buffer.from('encrypted');

      prisma.keyPair.create.mockResolvedValue(keyPair);
      vi.mocked(getUseKeychainClaim).mockResolvedValue(true);
      vi.mocked(safeStorage.encryptString).mockReturnValue(encryptedPrivateKey);

      await storeKeyPair(keyPair, null, false);

      expect(prisma.keyPair.create).toHaveBeenCalledWith({
        data: {
          ...keyPair,
          private_key: encryptedPrivateKey.toString('base64'),
        },
      });
    });

    test('Should store the key pair without encryption', async () => {
      prisma.keyPair.create.mockResolvedValue(keyPair);

      const encrypted = true;

      await storeKeyPair(keyPair, '', encrypted);

      expect(prisma.keyPair.create).toHaveBeenCalledWith({
        data: {
          ...keyPair,
        },
      });
    });

    test('Should throw error if the encrypt password is not provided and the keychain is not enabled', async () => {
      vi.mocked(getUseKeychainClaim).mockResolvedValue(false);

      await expect(storeKeyPair(keyPair, null, false)).rejects.toThrow(
        'Password is required to store unencrypted key pair',
      );
    });

    test("Should throw error if key pair can't be stored", async () => {
      prisma.keyPair.create.mockRejectedValue(new Error('Error'));

      const password = 'password';
      const encrypted = false;

      vi.mocked(encrypt).mockReturnValue(Promise.resolve('encrypted'));

      await expect(storeKeyPair(keyPair, password, encrypted)).rejects.toThrow('Error');

      prisma.keyPair.create.mockRejectedValue({});
      await expect(storeKeyPair(keyPair, '123', false)).rejects.toThrow('Failed to store key pair');
    });
  });

  describe('prepareKeyPairsReencryption', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should re-encrypt all key pairs of the user', async () => {
      const userId = 'user1';
      const oldPassword = 'password1';
      const newPassword = 'password2';
      // More keys than the crypto concurrency limit, to make sure none are dropped
      const keyPairs: KeyPair[] = Array.from({ length: 10 }, (_, i) => ({
        ...keyPair,
        id: `id${i}`,
        public_key: `public${i}`,
        private_key: `encrypted${i}`,
      }));

      vi.mocked(decrypt).mockImplementation(async (data, password) => `plain(${password}):${data}`);
      vi.mocked(encrypt).mockImplementation(async (data, password) => `enc(${password}):${data}`);
      prisma.keyPair.findMany.mockResolvedValue(keyPairs);

      const updates = await prepareKeyPairsReencryption(userId, oldPassword, newPassword);

      expect(prisma.keyPair.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: userId } }),
      );
      for (const kp of keyPairs) {
        expect(decrypt).toHaveBeenCalledWith(kp.private_key, oldPassword);
      }
      // Each key is decrypted with the old password and re-encrypted with the new one,
      // and the updates keep the order of the key pairs
      expect(updates).toEqual(
        keyPairs.map(kp => ({
          where: { id: kp.id, public_key: kp.public_key },
          data: { private_key: `enc(${newPassword}):plain(${oldPassword}):${kp.private_key}` },
        })),
      );
      // Preparing must not write anything
      expect(prisma.keyPair.update).not.toHaveBeenCalled();
    });

    test('Should reject if one key pair cannot be decrypted', async () => {
      const keyPairs: KeyPair[] = [
        { ...keyPair, id: '1' },
        { ...keyPair, id: '2' },
      ];

      vi.mocked(decrypt)
        .mockResolvedValueOnce('decryptedPrivateKey')
        .mockRejectedValueOnce(new Error('bad decrypt'));
      vi.mocked(encrypt).mockResolvedValue('encryptedPrivateKey2');
      prisma.keyPair.findMany.mockResolvedValue(keyPairs);

      await expect(prepareKeyPairsReencryption('user1', 'old', 'new')).rejects.toThrow(
        'bad decrypt',
      );

      expect(prisma.keyPair.update).not.toHaveBeenCalled();
    });
  });

  describe('decryptPrivateKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should retrieve and decrypt the private key if keychain is NOT used', async () => {
      const password = 'password1';

      prisma.keyPair.findFirst.mockResolvedValue(keyPair);
      vi.mocked(decrypt).mockReturnValue(Promise.resolve('decryptedPrivateKey'));

      const result = await decryptPrivateKey(keyPair.user_id, password, keyPair.public_key);

      expect(prisma.keyPair.findFirst).toHaveBeenCalledWith({
        where: { user_id: keyPair.user_id, public_key: keyPair.public_key },
        select: { private_key: true },
      });
      expect(decrypt).toHaveBeenCalledWith(keyPair.private_key, password);
      expect(result).toBe('decryptedPrivateKey');
    });

    test('Should retrieve and decrypt the private key if keychain is used', async () => {
      const password = 'password1';
      const decrypted = 'decryptedPrivateKey';

      prisma.keyPair.findFirst.mockResolvedValue(keyPair);
      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue(decrypted);

      const result = await decryptPrivateKey(keyPair.user_id, password, keyPair.public_key);

      expect(prisma.keyPair.findFirst).toHaveBeenCalledWith({
        where: { user_id: keyPair.user_id, public_key: keyPair.public_key },
        select: { private_key: true },
      });
      expect(result).toBe(decrypted);
    });

    test("Should pass empty string if key pair can't be found and keychain is used", async () => {
      const decrypted = '123';

      prisma.keyPair.findFirst.mockResolvedValueOnce(null);
      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);
      vi.mocked(safeStorage.decryptString).mockReturnValue(decrypted);

      const result = await decryptPrivateKey(keyPair.user_id, null, keyPair.public_key);

      expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from('', 'base64'));
      expect(result).toBe(decrypted);
    });

    test("Should pass empty string if key pair can't be found and keychain is NOT used", async () => {
      const password = 'password1';

      prisma.keyPair.findFirst.mockResolvedValue(null);
      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(false);

      await decryptPrivateKey(keyPair.user_id, password, keyPair.public_key);

      expect(prisma.keyPair.findFirst).toHaveBeenCalledWith({
        where: { user_id: keyPair.user_id, public_key: keyPair.public_key },
        select: { private_key: true },
      });
      expect(decrypt).toHaveBeenCalledWith('', password);
    });

    test('Should throw error if password is not provided', async () => {
      await expect(decryptPrivateKey(keyPair.user_id, null, keyPair.public_key)).rejects.toThrow(
        'Password is required to decrypt private key',
      );
    });

    test('Should re-encrypt and save when decrypting a legacy blob', async () => {
      const password = 'password1';

      prisma.keyPair.findFirst.mockResolvedValue(keyPair);
      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(false);
      vi.mocked(decrypt).mockReturnValue(Promise.resolve('decryptedPrivateKey'));
      vi.mocked(encrypt).mockReturnValue(Promise.resolve('v2:reEncrypted'));
      vi.mocked(isLegacyBlob).mockReturnValueOnce(true);

      const result = await decryptPrivateKey(keyPair.user_id, password, keyPair.public_key);

      expect(prisma.keyPair.updateMany).toHaveBeenCalledWith({
        where: { user_id: keyPair.user_id, public_key: keyPair.public_key },
        data: { private_key: 'v2:reEncrypted' },
      });
      expect(result).toBe('decryptedPrivateKey');
    });

    test('Should still return decrypted key if migration save fails', async () => {
      const password = 'password1';

      prisma.keyPair.findFirst.mockResolvedValue(keyPair);
      vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(false);
      vi.mocked(decrypt).mockReturnValue(Promise.resolve('decryptedPrivateKey'));
      vi.mocked(encrypt).mockReturnValue(Promise.resolve('v2:reEncrypted'));
      vi.mocked(isLegacyBlob).mockReturnValueOnce(true);
      prisma.keyPair.updateMany.mockRejectedValueOnce(new Error('DB error'));

      const result = await decryptPrivateKey(keyPair.user_id, password, keyPair.public_key);

      expect(result).toBe('decryptedPrivateKey');
    });
  });

  describe('deleteEncryptedPrivateKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the private keys of the user', async () => {
      await deleteEncryptedPrivateKeys(keyPair.user_id, keyPair.organization_id, null);

      expect(prisma.keyPair.updateMany).toHaveBeenCalledOnce();
    });
  });

  describe('deleteSecretHashes', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the key pairs of the user', async () => {
      await deleteSecretHashes(keyPair.user_id, keyPair.organization_id, null);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledOnce();
    });
  });

  describe('deleteKeyPair', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete a key pair with an id', async () => {
      await deleteKeyPair(keyPair.id);

      expect(prisma.keyPair.delete).toHaveBeenCalledWith({ where: { id: keyPair.id } });
    });
  });

  describe('extendWhere', () => {
    /* Test the function indirectly */

    beforeEach(() => {
      vi.resetAllMocks();
    });

    const org = {
      id: '123',
      serverUrl: 'some-url',
      key: 'key',
      nickname: '',
    };

    test('Should NOT extend the where clause without organization_id provided', async () => {
      const user_id = '333';
      const where: Prisma.KeyPairWhereInput = {
        user_id,
      };

      vi.mocked(getOrganization).mockResolvedValue(org);

      await deleteSecretHashes('333', null, null);

      expect(where).toEqual({ user_id });
    });

    test('Should extend the where clause with organization_id', async () => {
      const user_id = '333';
      const organization_user_id = 222;
      vi.mocked(getOrganization).mockResolvedValue(org);
      vi.mocked(getCurrentUser).mockResolvedValue({ userId: organization_user_id });

      await deleteSecretHashes('333', null, org.id);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: org.id, organization_user_id },
      });
    });

    test('Should extend the where clause with organization_id NULL', async () => {
      const user_id = '333';

      await deleteSecretHashes('333', null, null);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: null },
      });
    });

    test('Should NOT extend the where clause where organization_id but not active user', async () => {
      const user_id = '333';
      vi.mocked(getOrganization).mockResolvedValue(org);

      await deleteSecretHashes('333', null, org.id);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: null },
      });
    });

    test('Should NOT extend the where clause when organization is not found', async () => {
      const user_id = '333';
      vi.mocked(getOrganization).mockResolvedValue(null);

      await deleteSecretHashes('333', null, org.id);

      expect(getCurrentUser).not.toHaveBeenCalled();
      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: null },
      });
    });
  });

  describe('updateNickname', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update the nickname of the key pair', async () => {
      const nickname = 'new-nickname';

      await updateNickname(keyPair.id, nickname);

      expect(prisma.keyPair.update).toHaveBeenCalledWith({
        where: { id: keyPair.id },
        data: { nickname },
      });
    });
  });

  describe('updateMnemonicHash', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update the nickname of the key pair', async () => {
      const mnemonicHash = '0xabc';

      await updateMnemonicHash(keyPair.id, mnemonicHash);

      expect(prisma.keyPair.update).toHaveBeenCalledWith({
        where: { id: keyPair.id },
        data: { secret_hash: mnemonicHash },
      });
    });
  });

  describe('updateIndex', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should update the index of the key pair', async () => {
      const index = 1;

      await updateIndex(keyPair.id, index);

      expect(prisma.keyPair.update).toHaveBeenCalledWith({
        where: { id: keyPair.id },
        data: { index },
      });
    });
  });
});
