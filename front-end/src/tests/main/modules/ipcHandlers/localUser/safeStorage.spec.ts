import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import { STATIC_USER } from '@shared/constants';

import registerSafeStorageHandlers from '@main/modules/ipcHandlers/localUser/safeStorage';

import { safeStorage } from 'electron';
import { getUseKeychainClaim } from '@main/services/localUser/claim';
import { login } from '@main/services/localUser/auth';

import { initializeUseKeychain } from '@main/services/localUser/encryptionMode';
vi.mock('@main/services/localUser/encryptionMode', () => mockDeep());

vi.mock('@main/services/localUser', () => mockDeep());
vi.mock('@main/services/localUser/claim', () => mockDeep());
vi.mock('@main/services/localUser/auth', () => mockDeep());

describe('IPC handlers Safe Storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerSafeStorageHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = [
      'isKeychainAvailable',
      'initializeUseKeychain',
      'getUseKeychain',
      'getStaticUser',
      'encrypt',
      'decrypt',
    ];
    expect(events.every(e => getIPCHandler(`safeStorage:${e}`))).toBe(true);
  });

  test('Should set up isKeychainAvailable handler', async () => {
    const result = await invokeIPCHandler('safeStorage:isKeychainAvailable');
    expect(result).toEqual(process.platform === 'darwin');
  });

  test('Should initialize initializeUseKeychain handler', async () => {
    await invokeIPCHandler('safeStorage:initializeUseKeychain', false);
    expect(initializeUseKeychain).toHaveBeenCalledWith(false);
  });

  test('Should forward initialization errors', async () => {
    vi.mocked(initializeUseKeychain).mockRejectedValueOnce(
      new Error('Keychain mode already initialized'),
    );
    await expect(invokeIPCHandler('safeStorage:initializeUseKeychain', false)).rejects.toThrow(
      'Keychain mode already initialized',
    );
  });

  test('Should read the canonical mode', async () => {
    vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);
    expect(await invokeIPCHandler('safeStorage:getUseKeychain')).toBe(true);
    vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(false);
    expect(await invokeIPCHandler('safeStorage:getUseKeychain')).toBe(false);
  });

  test('Should reject an uninitialized mode', async () => {
    vi.mocked(getUseKeychainClaim).mockRejectedValueOnce(
      new Error('Keychain mode not initialized'),
    );
    await expect(invokeIPCHandler('safeStorage:getUseKeychain')).rejects.toThrow(
      'Keychain mode not initialized',
    );
  });

  test('Should set up getStaticUser handler', async () => {
    vi.mocked(getUseKeychainClaim).mockResolvedValueOnce(true);

    await invokeIPCHandler('safeStorage:getStaticUser');
    expect(login).toHaveBeenCalledWith(STATIC_USER, STATIC_USER);
  });

  test('Should getStaticUser throw if NOT initialized', async () => {
    vi.mocked(getUseKeychainClaim).mockRejectedValueOnce(
      new Error('Keychain mode not initialized'),
    );

    await expect(invokeIPCHandler('safeStorage:getStaticUser')).rejects.toThrow(
      'Keychain mode not initialized',
    );
  });

  test('Should set up encrypt handler', async () => {
    const data = 'test data';
    const encryptedData = Buffer.from('encrypted data').toString('base64');
    vi.mocked(safeStorage.encryptString).mockReturnValueOnce(Buffer.from('encrypted data'));

    const result = await invokeIPCHandler('safeStorage:encrypt', data);
    expect(result).toEqual(encryptedData);
    expect(safeStorage.encryptString).toHaveBeenCalledWith(data);
  });

  test('Should set up decrypt handler', async () => {
    const encryptedData = Buffer.from('encrypted data').toString('base64');
    const decryptedData = 'decrypted data';
    vi.mocked(safeStorage.decryptString).mockReturnValueOnce(decryptedData);

    const result = await invokeIPCHandler('safeStorage:decrypt', encryptedData, 'base64');
    expect(result).toEqual(decryptedData);
    expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(encryptedData, 'base64'));
  });
});
