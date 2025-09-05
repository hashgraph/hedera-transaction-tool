import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import { STATIC_USER, USE_KEYCHAIN } from '@shared/constants';

import registerSafeStorageHandlers from '@main/modules/ipcHandlers/localUser/safeStorage';

import { Claim } from '@prisma/client';
import { safeStorage } from 'electron';
import { addClaim, getClaims } from '@main/services/localUser/claim';
import { login, register } from '@main/services/localUser/auth';

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
    vi.mocked(getClaims).mockResolvedValueOnce([]);
    vi.mocked(register).mockResolvedValueOnce({
      id: STATIC_USER,
      email: STATIC_USER,
      password: STATIC_USER,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await invokeIPCHandler('safeStorage:initializeUseKeychain', false);
    expect(register).toHaveBeenCalledWith(STATIC_USER, STATIC_USER);
    expect(addClaim).toHaveBeenCalledWith(STATIC_USER, USE_KEYCHAIN, 'false');
  });

  test('Should throw if initializeUseKeychain handler is already called', async () => {
    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);

    await expect(invokeIPCHandler('safeStorage:initializeUseKeychain', false)).rejects.toThrow(
      'Keychain mode already initialized',
    );
  });

  test('Should set up getUseKeychain handler if initialized', async () => {
    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);
    let result = await invokeIPCHandler('safeStorage:getUseKeychain');
    expect(result).toEqual(true);

    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'false' } as Claim]);
    result = await invokeIPCHandler('safeStorage:getUseKeychain');
    expect(result).toEqual(false);
  });

  test('Should getUseKeychain throw if NOT initialized', async () => {
    vi.mocked(getClaims).mockResolvedValueOnce([]);

    await expect(invokeIPCHandler('safeStorage:getUseKeychain')).rejects.toThrow(
      'Keychain mode not initialized',
    );
  });

  test('Should set up getStaticUser handler', async () => {
    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);

    await invokeIPCHandler('safeStorage:getStaticUser');
    expect(login).toHaveBeenCalledWith(STATIC_USER, STATIC_USER);
  });

  test('Should getStaticUser throw if NOT initialized', async () => {
    vi.mocked(getClaims).mockResolvedValueOnce([]);

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
