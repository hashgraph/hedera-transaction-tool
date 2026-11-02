import { app, BrowserWindow } from 'electron';

import { PROTOCOL_NAME } from '@main/modules/deepLink';
import * as path from 'path';
import { deleteAllTempFolders } from '@main/services/localUser';
import { probeKeychainAtStartup } from '@main/utils/keychain';
import { restoreOrCreateWindow } from '@main/windows/mainWindow';
import initDatabase from '@main/db/init';
import { MockedObject } from 'vitest';

vi.mock('path', () => ({
  resolve: vi.fn(),
}));
vi.mock('@electron-toolkit/utils', () => ({}));
vi.mock('electron', () => {
  return {
    app: {
      on: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
      quit: vi.fn(),
      requestSingleInstanceLock: vi.fn(() => true),
    },
    BrowserWindow: vi.fn(),
  };
});
vi.mock('@main/db/init', () => ({ default: vi.fn() }));
vi.mock('@main/utils/keychain', () => ({ probeKeychainAtStartup: vi.fn() }));
vi.mock('@main/services/localUser', () => ({ deleteAllTempFolders: vi.fn() }));
const mockLogger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock('@main/modules/logger', () => ({
  default: vi.fn(),
  createLogger: vi.fn(() => mockLogger),
}));
vi.mock('@main/modules/menu', () => ({
  default: vi.fn(),
}));
vi.mock('@main/modules/deepLink', () => ({
  default: vi.fn(),
  PROTOCOL_NAME: 'test-protocol',
}));
vi.mock('@main/modules/ipcHandlers', () => ({ default: vi.fn() }));
vi.mock('@main/windows/mainWindow', () => ({
  restoreOrCreateWindow: vi.fn(),
}));

describe('Electron entry file', async () => {
  vi.mocked(BrowserWindow).mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
  } as unknown as BrowserWindow);

  test('Should setup deep link in defaultApp', async () => {
    Object.defineProperty(process, 'defaultApp', {
      value: true,
    });
    vi.mocked(path.resolve).mockReturnValue('test-path');

    await import('@main/index');

    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith(PROTOCOL_NAME, process.execPath, [
      'test-path',
    ]);
  });

  test('Should delete temp folder on before-quit event', async () => {
    const appMO = app as unknown as MockedObject<Electron.App>;

    vi.mocked(deleteAllTempFolders).mockResolvedValueOnce();
    //@ts-expect-error Incorrect type definition
    const beforeQuitHandler = appMO.on.mock.calls.find(([event]) => event === 'before-quit');
    expect(beforeQuitHandler).toBeDefined();
    expect(beforeQuitHandler![1]).toBeDefined();

    //@ts-expect-error Incorrect type definition
    beforeQuitHandler && (await beforeQuitHandler[1]({ preventDefault: vi.fn() }));

    expect(deleteAllTempFolders).toHaveBeenCalledOnce();
  });

  test('Should probe the keychain before creating the main window on ready', async () => {
    const appMO = app as unknown as MockedObject<Electron.App>;
    //@ts-expect-error Incorrect type definition
    const readyHandler = appMO.on.mock.calls.find(([event]) => event === 'ready');
    expect(readyHandler).toBeDefined();

    // Whatever runs after the window is created is not relevant here
    //@ts-expect-error Incorrect type definition
    await readyHandler![1]().catch(() => {});

    expect(probeKeychainAtStartup).toHaveBeenCalledOnce();
    expect(restoreOrCreateWindow).toHaveBeenCalledOnce();
    expect(vi.mocked(probeKeychainAtStartup).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(restoreOrCreateWindow).mock.invocationCallOrder[0],
    );
  });

  test('Should log the error and still create the window when app initialization fails', async () => {
    const initError = new Error('db init failed');
    vi.mocked(initDatabase).mockRejectedValueOnce(initError);
    vi.mocked(restoreOrCreateWindow).mockClear();
    vi.resetModules();
    await import('@main/index');

    const appMO = app as unknown as MockedObject<Electron.App>;
    //@ts-expect-error Incorrect type definition
    const readyCalls = appMO.on.mock.calls.filter(([event]) => event === 'ready');
    //@ts-expect-error Incorrect type definition
    await readyCalls[readyCalls.length - 1][1]().catch(() => {});

    expect(mockLogger.error).toHaveBeenCalledWith('App initialization failed', {
      error: initError,
    });
    expect(restoreOrCreateWindow).toHaveBeenCalledOnce();
  });
});
