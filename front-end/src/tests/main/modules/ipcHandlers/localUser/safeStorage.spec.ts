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
      'checkKeychain',
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

  test('Should report the keychain as usable when the canary round trips', async () => {
    vi.mocked(safeStorage.encryptString).mockImplementation(s => Buffer.from(s));
    vi.mocked(safeStorage.decryptString).mockImplementation(b => b.toString());

    expect(await invokeIPCHandler('safeStorage:checkKeychain')).toBe(true);
  });

  test('Should report the keychain as unusable when encryption fails', async () => {
    vi.mocked(safeStorage.encryptString).mockImplementation(() => {
      throw new Error('Encryption is not available');
    });

    expect(await invokeIPCHandler('safeStorage:checkKeychain')).toBe(false);
  });
});
