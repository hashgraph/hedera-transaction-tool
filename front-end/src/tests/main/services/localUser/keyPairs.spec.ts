import { expect, vi } from 'vitest';

import { safeStorage } from 'electron';

import { KeyPair, Prisma } from '@prisma/client';

import prisma from '@main/db/__mocks__/prisma';

import {
  changeDecryptionPassword,
  decryptPrivateKey,
  deleteEncryptedPrivateKeys,
  deleteKeyPair,
  deleteSecretHashes,
  getKeyPairs,
  getSecretHashes,
  storeKeyPair,
  updateMnemonicHash,
  updateNickname,
} from '@main/services/localUser/keyPairs';
import { getOrganization } from '@main/services/localUser/organizations';
import { getCurrentUser } from '@main/services/localUser/organizationCredentials';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

import { decrypt, encrypt } from '@main/utils/crypto';

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

  describe('getSecretHashes', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should get the secret hashes for a user in organization', async () => {
      const groups: Prisma.PickEnumerable<Prisma.KeyPairGroupByOutputType, 'secret_hash'[]>[] = [
        { secret_hash: keyPair.secret_hash },
      ];

      //@ts-expect-error Incorrect typing of groupBy
      prisma.keyPair.groupBy.mockResolvedValue(groups);

      const secretHashes = await getSecretHashes(keyPair.user_id, keyPair.organization_id);

      expect(secretHashes).toEqual([keyPair.secret_hash]);
    });
  });

  describe('getKeyPairs', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('getKeyPairs should retrieve the key pairs for the user', async () => {
      prisma.keyPair.findMany.mockResolvedValue([keyPair]);

      const result = await getKeyPairs(keyPair.user_id, keyPair.organization_id);

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

      vi.mocked(encrypt).mockReturnValue('encrypted');

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

      vi.mocked(encrypt).mockReturnValue('encrypted');

      await expect(storeKeyPair(keyPair, password, encrypted)).rejects.toThrow('Error');

      prisma.keyPair.create.mockRejectedValue({});
      await expect(storeKeyPair(keyPair, '123', false)).rejects.toThrow('Failed to store key pair');
    });
  });

  describe('changeDecryptionPassword', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should re-encrypt all key pairs of the user', async () => {
      const userId = 'user1';
      const oldPassword = 'password1';
      const newPassword = 'password2';
      const keyPairs: KeyPair[] = [{ ...keyPair }];

      vi.mocked(decrypt).mockReturnValue('decryptedPrivateKey');
      vi.mocked(encrypt).mockReturnValue('encryptedPrivateKey2');
      prisma.keyPair.findMany.mockResolvedValue(keyPairs);

      await changeDecryptionPassword(userId, oldPassword, newPassword);

      expect(decrypt).toHaveBeenCalledWith(keyPairs[0].private_key, oldPassword);
      expect(encrypt).toHaveBeenCalledWith('decryptedPrivateKey', newPassword);
      expect(prisma.keyPair.update).toHaveBeenCalledWith({
        where: { id: keyPairs[0].id, public_key: keyPairs[0].public_key },
        data: { private_key: 'encryptedPrivateKey2' },
      });
    });
  });

  describe('decryptPrivateKey', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should retrieve and decrypt the private key if keychain is NOT used', async () => {
      const password = 'password1';

      prisma.keyPair.findFirst.mockResolvedValue(keyPair);
      vi.mocked(decrypt).mockReturnValue('decryptedPrivateKey');

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
  });

  describe('deleteEncryptedPrivateKeys', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the private keys of the user', async () => {
      await deleteEncryptedPrivateKeys(keyPair.user_id, keyPair.organization_id);

      expect(prisma.keyPair.updateMany).toHaveBeenCalledOnce();
    });
  });

  describe('deleteSecretHashes', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should delete the key pairs of the user', async () => {
      await deleteSecretHashes(keyPair.user_id, keyPair.organization_id);

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

      await deleteSecretHashes('333');

      expect(where).toEqual({ user_id });
    });

    test('Should extend the where clause with organization_id', async () => {
      const user_id = '333';
      const organization_user_id = 222;
      vi.mocked(getOrganization).mockResolvedValue(org);
      vi.mocked(getCurrentUser).mockResolvedValue({ userId: organization_user_id });

      await deleteSecretHashes('333', org.id);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: org.id, organization_user_id },
      });
    });

    test('Should extend the where clause with organization_id NULL', async () => {
      const user_id = '333';

      await deleteSecretHashes('333', null);

      expect(prisma.keyPair.deleteMany).toHaveBeenCalledWith({
        where: { user_id, organization_id: null },
      });
    });

    test('Should NOT extend the where clause where organization_id but not active user', async () => {
      const user_id = '333';
      vi.mocked(getOrganization).mockResolvedValue(org);

      await deleteSecretHashes('333', org.id);

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
});
