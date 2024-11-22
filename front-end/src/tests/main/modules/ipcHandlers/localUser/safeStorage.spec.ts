import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import { USE_KEYCHAIN } from '@main/shared/constants';

import registerSafeStorageHandlers, {
  STATIC_USER,
} from '@main/modules/ipcHandlers/localUser/safeStorage';

import { Claim } from '@prisma/client';
import { addClaim, getClaims } from '@main/services/localUser/claim';
import { login, register } from '@main/services/localUser/auth';
import { ipcMain, safeStorage } from 'electron';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  safeStorage: { isEncryptionAvailable: vi.fn(), encryptString: vi.fn(), decryptString: vi.fn() },
}));
vi.mock('@main/services/localUser', () => ({
  resetDatabase: vi.fn(),
}));
vi.mock('@main/services/localUser/claim', () => ({
  addClaim: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock('@main/services/localUser/auth', () => ({
  login: vi.fn(),
  register: vi.fn(),
}));

describe('IPC handlers Safe Storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerSafeStorageHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = [
      'isKeychainAvailable',
      'initializeUseKeychain',
      'getUseKeychain',
      'getStaticUser',
      'encrypt',
      'decrypt',
    ];

    expect(
      events.every(e =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `safeStorage:${e}`),
      ),
    ).toBe(true);
  });

  test('Should set up isKeychainAvailable handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'safeStorage:isKeychainAvailable',
    );
    expect(handler).toBeDefined();

    handler && (await handler[1](event));
  });

  test('Should initialize initializeUseKeychain handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'safeStorage:initializeUseKeychain',
    );
    expect(handler).toBeDefined();

    vi.mocked(getClaims).mockResolvedValueOnce([]);
    vi.mocked(register).mockResolvedValueOnce({
      id: STATIC_USER,
      email: STATIC_USER,
      password: STATIC_USER,
      created_at: new Date(),
      updated_at: new Date(),
    });

    handler && (await handler[1](event, false));
    expect(register).toHaveBeenCalledWith(STATIC_USER, STATIC_USER);
    expect(addClaim).toHaveBeenCalledWith(STATIC_USER, USE_KEYCHAIN, 'false');
  });

  test('Should throw if initializeUseKeychain handler is already called', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'safeStorage:initializeUseKeychain',
    );
    expect(handler).toBeDefined();
    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);
    if (handler) {
      await expect(() => handler[1](event, false)).rejects.toThrow(
        'Keychain mode already initialized',
      );
    }
  });

  test('Should set up getUseKeychain handler if initialized', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:getUseKeychain');
    expect(handler).toBeDefined();

    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);

    handler && expect(await handler[1](event)).toEqual(true);

    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'false' } as Claim]);

    handler && expect(await handler[1](event)).toEqual(false);
  });

  test('Should getUseKeychain throw if NOT initialized', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:getUseKeychain');
    expect(handler).toBeDefined();

    vi.mocked(getClaims).mockResolvedValueOnce([]);

    if (handler) {
      await expect(() => handler[1](event)).rejects.toThrow('Keychain mode not initialized');
    }
  });

  test('Should set up getStaticUser handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:getStaticUser');
    expect(handler).toBeDefined();

    vi.mocked(getClaims).mockResolvedValueOnce([{ claim_value: 'true' } as Claim]);

    handler && (await handler[1](event));
    expect(login).toHaveBeenCalledWith(STATIC_USER, STATIC_USER);
  });

  test('Should getUseKeychain throw if NOT initialized', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:getStaticUser');
    expect(handler).toBeDefined();

    vi.mocked(getClaims).mockResolvedValueOnce([]);

    if (handler) {
      await expect(() => handler[1](event)).rejects.toThrow('Keychain mode not initialized');
    }
  });

  test('Should set up encrypt handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:encrypt');
    expect(handler).toBeDefined();

    const data = 'test data';
    const encryptedData = Buffer.from('encrypted data').toString('base64');
    vi.mocked(safeStorage.encryptString).mockReturnValueOnce(Buffer.from('encrypted data'));

    handler && expect(await handler[1](event, data)).toEqual(encryptedData);
    expect(safeStorage.encryptString).toHaveBeenCalledWith(data);
  });

  test('Should set up decrypt handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'safeStorage:decrypt');
    expect(handler).toBeDefined();

    const encryptedData = Buffer.from('encrypted data').toString('base64');
    const decryptedData = 'decrypted data';
    vi.mocked(safeStorage.decryptString).mockReturnValueOnce(decryptedData);

    handler && expect(await handler[1](event, encryptedData, 'base64')).toEqual(decryptedData);
    expect(safeStorage.decryptString).toHaveBeenCalledWith(Buffer.from(encryptedData, 'base64'));
  });
});
