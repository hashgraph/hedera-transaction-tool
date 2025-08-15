import { describe, test, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Hbar, HbarUnit } from '@hashgraph/sdk';

import { CommonNetwork } from '@shared/enums';
import {
  DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
  SELECTED_NETWORK,
  UPDATE_LOCATION,
} from '@shared/constants';

import {
  locateDataMigrationFiles,
  decryptMigrationMnemonic,
  getDataMigrationKeysPath,
  getAccountInfoFromFile,
  migrateUserData,
  parseUserProperties,
  getSalt,
  SALT_LENGTH,
  KEY_LENGTH,
} from '@main/services/localUser/dataMigration';
import { addAccount } from '@main/services/localUser/accounts';
import { addClaim } from '@main/services/localUser/claim';
import { addPublicKey } from '@main/services/localUser/publicKeyMapping';
import { safeAwait } from '@main/utils/safeAwait';

vi.mock('fs');
vi.mock('crypto');
vi.mock('argon2');
vi.mock('electron', () => ({
  app: { getPath: vi.fn((key: string) => key) },
}));
vi.mock('@main/services/localUser/accounts');
vi.mock('@main/services/localUser/claim');
vi.mock('@main/services/localUser/publicKeyMapping');
vi.mock('@main/utils/safeAwait');

describe('Data Migration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('locateDataMigrationFiles', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return true when all files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      expect(locateDataMigrationFiles()).toBe(true);
    });

    test('Should return false when any file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true).mockReturnValueOnce(false);
      expect(locateDataMigrationFiles()).toBe(false);
    });
  });

  describe('decryptMigrationMnemonic', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });
    test('Should correctly decrypt mnemonic', async () => {
      const mockContent = 'hash=UeMaPSnZhVWUZyQBzmHnSChoYUUOTouHW+MQ66ILRiwFMQyQgVlkjF2R19BB0qXa';
      const mockPassword = 'password';
      const mockDecryptedMnemonic = 'word1 word2 word3';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
      vi.mocked(crypto.createDecipheriv).mockReturnValue({
        update: vi.fn().mockReturnValue(Buffer.from(mockDecryptedMnemonic)),
        final: vi.fn().mockReturnValue(Buffer.from('')),
        setAuthTag: vi.fn(),
      } as unknown as crypto.Decipher);

      const result = await decryptMigrationMnemonic(mockPassword);
      expect(result).toEqual(mockDecryptedMnemonic.split(' '));
    });

    test('Should correctly decrypt legacy mnemonic', async () => {
      const mockContent =
        'hash=UeMaPSnZhVWUZyQBzmHnSChoYUUOTouHW+MQ66ILRiwFMQyQgVlkjF2R19BB0qXa\nlegacy=true';
      const mockPassword = 'password';
      const mockDecryptedMnemonic = 'word1 word2 word3';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
      vi.mocked(crypto.createDecipheriv).mockReturnValue({
        update: vi.fn().mockReturnValue(Buffer.from(mockDecryptedMnemonic)),
        final: vi.fn().mockReturnValue(Buffer.from('')),
        setAuthTag: vi.fn(),
      } as unknown as crypto.Decipher);

      const result = await decryptMigrationMnemonic(mockPassword);
      expect(result).toEqual(mockDecryptedMnemonic.split(' '));
    });

    test('Should return null if no legacy mnemonic', async () => {
      const mockContent =
        'hash=UeMaPSnZhVWUZyQBzmHnSChoYUUOTouHW+MQ66ILRiwFMQyQgVlkjF2R19BB0qXa\nlegacy=true';
      const mockPassword = 'password';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
        Buffer.from('AES|256|CBC|PKCS5Padding|'),
      );

      const result = await decryptMigrationMnemonic(mockPassword);
      expect(result).toEqual(null);
    });

    test('Should throw error when hash is not found', async () => {
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockContent);

      await expect(decryptMigrationMnemonic('password')).rejects.toThrow(
        'No hash found at location',
      );
    });

    test('Should return null if mnemonic cannot be decrypted', async () => {
      const mockContent = 'hash=UeMaPSnZhVWUZyQBzmHnSChoYUUOTouHW+MQ66ILRiwFMQyQgVlkjF2R19BB0qXa';
      const mockPassword = 'password';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
      vi.mocked(crypto.createDecipheriv).mockReturnValue({
        update: vi.fn().mockReturnValue(''),
        final: vi.fn().mockReturnValue(''),
        setAuthTag: vi.fn(),
      } as unknown as crypto.Decipher);

      const result = await decryptMigrationMnemonic(mockPassword);
      expect(result).toBe(null);
    });

    test('Should return null if mnemonic cannot be decrypted', async () => {
      const mockContent = 'hash=UeMaPSnZhVWUZyQBzmHnSChoYUUOTouHW+MQ66ILRiwFMQyQgVlkjF2R19BB0qXa';
      const mockPassword = 'password';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]));
      vi.mocked(crypto.createDecipheriv).mockReturnValue({
        update: vi.fn().mockReturnValue(''),
        final: vi.fn().mockImplementationOnce(() => {
          throw new Error('Final error');
        }),
        setAuthTag: vi.fn(),
      } as unknown as crypto.Decipher);

      const result = await decryptMigrationMnemonic(mockPassword);
      expect(result).toBe(null);
    });
  });

  describe('getDataMigrationKeysPath', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should return correct keys path', () => {
      const result = getDataMigrationKeysPath();
      const expectedSuffix = path.join('TransactionTools', 'Keys');
      expect(result.endsWith(expectedSuffix)).toBe(true);
    });
  });

  describe('getAccountInfoFromFile', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    test('Should correctly read account info from files', async () => {
      const mockDirectory = '/mock/directory';
      const mockFiles = ['account1.json', 'account2-TESTNET.json'];
      const mockFileContent = JSON.stringify({
        accountID: {
          realmNum: 0,
          shardNum: 0,
          accountNum: 123,
        },
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValueOnce(mockFiles as any);
      vi.mocked(fs.promises.readFile).mockResolvedValue(mockFileContent);

      const result = await getAccountInfoFromFile(mockDirectory, CommonNetwork.MAINNET);

      expect(result).toEqual([
        { nickname: 'account1', accountID: '0.0.123', network: CommonNetwork.MAINNET },
        { nickname: 'account2-TESTNET', accountID: '0.0.123', network: CommonNetwork.TESTNET },
      ]);
    });

    test('Should continue with other files if one fails', async () => {
      const mockDirectory = '/mock/directory';
      const mockFiles = ['account1.json', 'account2-TESTNET.json'];
      const mockFileContent = JSON.stringify({
        accountID: {
          realmNum: 0,
          shardNum: 0,
          accountNum: 123,
        },
      });
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockResolvedValueOnce(mockFiles as any);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockFileContent);
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('Read error'));

      const result = await getAccountInfoFromFile(mockDirectory, CommonNetwork.MAINNET);

      expect(result).toEqual([
        { nickname: 'account1', accountID: '0.0.123', network: CommonNetwork.MAINNET },
      ]);
    });

    test('Should return empty array if directory does not exist', async () => {
      const mockDirectory = '/mock/directory';
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await getAccountInfoFromFile(mockDirectory, CommonNetwork.MAINNET);

      expect(result).toEqual([]);
    });
  });

  describe('migrateUserData', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    const mockAccounts = () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      vi.mocked(fs.promises.readdir).mockResolvedValueOnce(['account1.json'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
        JSON.stringify({
          accountID: {
            realmNum: 0,
            shardNum: 0,
            accountNum: 123,
          },
        }),
      );
    };

    const mockPublicKeys = () => {
      vi.mocked(fs.existsSync).mockReturnValueOnce(true);
      vi.mocked(fs.promises.readdir).mockResolvedValueOnce(['publicKey1.pub'] as any);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(
          '302a300506032b6570032100a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
      );
    }

    test('Should correctly migrate user', async () => {
      const mockUserId = 'userId';
      const mockContent =
        'defaultTxFee=1000\ncurrentNetwork=TESTNET\ncredentials={"mockDir": "svet"}';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      mockAccounts();
      mockPublicKeys();

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 1,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 1,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addClaim).toHaveBeenCalledWith(mockUserId, SELECTED_NETWORK, CommonNetwork.TESTNET);
      expect(addClaim).toHaveBeenCalledWith(mockUserId, UPDATE_LOCATION, 'mockDir/InputFiles');
      expect(addAccount).toHaveBeenCalledWith(
        mockUserId,
        '0.0.123',
        CommonNetwork.TESTNET,
        'account1',
      );
      expect(addPublicKey).toHaveBeenCalledWith(
        '302a300506032b6570032100a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        'publicKey1',
      );
    });

    test('Should correctly migrate updates location when /InputFiles suffix exists', async () => {
      const mockUserId = 'userId';
      const mockContent = 'credentials={"mockDir/InputFiles": "svet"}';
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      await migrateUserData(mockUserId);

      expect(addClaim).toHaveBeenCalledWith(mockUserId, UPDATE_LOCATION, 'mockDir/InputFiles');
    });

    test('Should handle errors gracefully when reading properties file', async () => {
      const mockUserId = 'userId';
      vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('Read error'));

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: null,
        currentNetwork: CommonNetwork.MAINNET,
        publicKeysImported: 0,
      });
    });

    test('Should handle errors gracefully when adding claim', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      mockAccounts();
      mockPublicKeys();

      vi.mocked(safeAwait).mockResolvedValueOnce({
        data: undefined,
        error: new Error('Claim error'),
      });
      vi.mocked(safeAwait).mockResolvedValueOnce({
        data: undefined,
        error: new Error('failed to add claim'),
      });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 1,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 1,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).toHaveBeenCalledWith(
        mockUserId,
        '0.0.123',
        CommonNetwork.TESTNET,
        'account1',
      );
      expect(addPublicKey).toHaveBeenCalledWith(
        '302a300506032b6570032100a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        'publicKey1',
      );
    });

    test('Should handle errors gracefully when adding account', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      mockAccounts();
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({
        data: undefined,
        error: new Error('Add account error'),
      });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 0,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).toHaveBeenCalledWith(
        mockUserId,
        '0.0.123',
        CommonNetwork.TESTNET,
        'account1',
      );
    });

    test('Should handle missing defaultTxFee gracefully', async () => {
      const mockUserId = 'userId';
      const mockContent = 'currentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      mockAccounts();
      mockPublicKeys();

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 1,
        defaultMaxTransactionFee: null,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 1,
      });
      expect(addClaim).toHaveBeenCalledTimes(1);
      expect(addAccount).toHaveBeenCalledWith(
        mockUserId,
        '0.0.123',
        CommonNetwork.TESTNET,
        'account1',
      );
    });

    test('Should handle missing currentNetwork gracefully', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      mockAccounts();
      mockPublicKeys();

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 1,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.MAINNET,
        publicKeysImported: 1,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).toHaveBeenCalledWith(
        mockUserId,
        '0.0.123',
        CommonNetwork.MAINNET,
        'account1',
      );
    });

    test('Should handle empty account data gracefully', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockContent);
      vi.mocked(fs.promises.readdir).mockResolvedValue([]);
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 0,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).not.toHaveBeenCalled();
    });

    test('Should handle errors gracefully when reading account files', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValue(mockContent);
      vi.mocked(fs.promises.readdir).mockRejectedValue(new Error('Read error'));

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 0,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).not.toHaveBeenCalled();
    });

    test('Should handle errors gracefully when reading account files', async () => {
      const mockUserId = 'userId';
      const mockContent = 'defaultTxFee=1000\ncurrentNetwork=TESTNET';

      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.promises.readdir).mockRejectedValueOnce(new Error('Read dir error'));

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: 1000,
        currentNetwork: CommonNetwork.TESTNET,
        publicKeysImported: 0,
      });
      expect(addClaim).toHaveBeenCalledWith(
        mockUserId,
        DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
        Hbar.fromTinybars(1000).toString(HbarUnit.Tinybar),
      );
      expect(addAccount).not.toHaveBeenCalled();
    });

    test('Should handle errors gracefully when adding update location', async () => {
      const mockUserId = 'userId';
      const mockContent = 'credentials={"mockDir": "svet"}';
      vi.mocked(fs.promises.readFile).mockResolvedValueOnce(mockContent);

      vi.mocked(safeAwait).mockResolvedValueOnce({ data: undefined, error: undefined });
      vi.mocked(safeAwait).mockResolvedValueOnce({
        data: undefined,
        error: new Error('Claim error'),
      });

      vi.mocked(addClaim).mockRejectedValueOnce(new Error('Claim error'));

      const result = await migrateUserData(mockUserId);
      expect(result).toEqual({
        accountsImported: 0,
        defaultMaxTransactionFee: null,
        currentNetwork: CommonNetwork.MAINNET,
        publicKeysImported: 0,
      });
      expect(addClaim).toHaveBeenCalledWith(mockUserId, UPDATE_LOCATION, 'mockDir/InputFiles');
    });
  });

  describe('parseUserProperties', () => {
    test('should return an empty object for empty content', () => {
      const content = '';
      const result = parseUserProperties(content);
      expect(result).toEqual({});
    });

    test('should parse valid key-value pairs', () => {
      const content = 'key1=value1\nkey2=value2';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    test('should parse JSON values', () => {
      const content = 'key1={"subkey":"subvalue"}';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: { subkey: 'subvalue' } });
    });

    test('should parse boolean values', () => {
      const content = 'key1=true\nkey2=false';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: true, key2: false });
    });

    test('should parse numeric values', () => {
      const content = 'key1=123\nkey2=456.78';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: 123, key2: 456.78 });
    });

    test('should ignore invalid lines', () => {
      const content = 'key1=value1\ninvalidline\nkey2=value2';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    test('should ignore lines with missing key or value', () => {
      const content = 'key1=value1\nkey2=\n=value2\nkey3=value3';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: 'value1', key3: 'value3' });
    });

    test('should handle escaped colons in JSON values', () => {
      const content = 'key1={"subkey":"subvalue\\:withcolon"}';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: { subkey: 'subvalue:withcolon' } });
    });

    test('should trim whitespace from keys and values', () => {
      const content = ' key1 = value1 \n key2 = value2 ';
      const result = parseUserProperties(content);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });
  });

  describe('getSalt', () => {
    test('should return an empty buffer if token is empty', () => {
      const result = getSalt('');
      expect(result).toEqual(Buffer.alloc(0));
    });

    test('should return an empty buffer if token length is less than SALT_LENGTH + KEY_LENGTH', () => {
      const invalidToken = Buffer.alloc(SALT_LENGTH + KEY_LENGTH - 1).toString('base64');
      const result = getSalt(invalidToken);
      expect(result).toEqual(Buffer.alloc(0));
    });

    test('should return the correct salt if token length is valid', () => {
      const validToken = Buffer.alloc(SALT_LENGTH + KEY_LENGTH, 'a').toString('base64');
      const expectedSalt = Buffer.alloc(SALT_LENGTH, 'a');
      const result = getSalt(validToken);
      expect(result).toEqual(expectedSalt);
    });

    test('should handle base64 decoding correctly', () => {
      const validToken = Buffer.from('a'.repeat(SALT_LENGTH + KEY_LENGTH)).toString('base64');
      const expectedSalt = Buffer.from('a'.repeat(SALT_LENGTH));
      const result = getSalt(validToken);
      expect(result).toEqual(expectedSalt);
    });
  });
});
