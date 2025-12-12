import { app, BrowserWindow } from 'electron';

import { PROTOCOL_NAME } from '@main/modules/deepLink';
import * as path from 'path';
import { deleteAllTempFolders } from '@main/services/localUser';
import { MockedObject } from 'vitest';

vi.mock('path', () => ({
  resolve: vi.fn(),
}));
vi.mock('@electron-toolkit/utils', () => ({
  is: {
    dev: false,
  },
}));
vi.mock('electron-updater', () => ({
  autoUpdater: {
    logger: null,
    autoDownload: false,
    forceDevUpdateConfig: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
  },
  ProgressInfo: {},
  UpdateInfo: {},
}));
vi.mock('electron', () => {
  return {
    app: {
      on: vi.fn(),
      setAsDefaultProtocolClient: vi.fn(),
      quit: vi.fn(),
      getVersion: vi.fn(() => '1.0.0'),
    },
    BrowserWindow: vi.fn(),
  };
});
vi.mock('@main/db/init', () => ({ default: vi.fn() }));
vi.mock('@main/services/localUser', () => ({ deleteAllTempFolders: vi.fn() }));
vi.mock('@main/modules/logger', () => ({
  default: vi.fn(),
  getAppUpdateLogger: vi.fn(() => ({
    transports: {
      file: {
        fileName: 'app-updates.log',
        level: 'debug',
      },
    },
  })),
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

  Object.defineProperty(process, 'defaultApp', {
    value: true,
    configurable: true,
  });
  vi.mocked(path.resolve).mockReturnValue('test-path');

  await import('@main/index');

  test('Should setup deep link in defaultApp', async () => {
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
});
