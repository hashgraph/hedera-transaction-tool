import { MockedClass, MockedObject } from 'vitest';

import registerThemeListeners, {
  removeListeners,
  sendUpdateThemeEventTo,
} from '@main/modules/ipcHandlers/theme';

import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => {
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;
  bw.getAllWindows = vi.fn();
  Object.defineProperty(bw.prototype, 'webContents', {
    value: {
      send: vi.fn(),
    },
    writable: false,
    enumerable: true,
  });

  return {
    BrowserWindow: bw,
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn(),
    },
    nativeTheme: {
      removeAllListeners: vi.fn(),
      listenerCount: vi.fn(),
      shouldUseDarkColors: true,
      themeSource: 'system',
      on: vi.fn(),
    },
  };
});

describe('registerThemeListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerThemeListeners();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each theme event', () => {
    const eventNames = ['isDark', 'toggle', 'mode'];

    expect(
      eventNames.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `theme:${util}`),
      ),
    ).toBe(true);
  });

  test("Should return the nativeTheme's value in theme:isDark", () => {
    const isDarkHandler = ipcMainMO.handle.mock.calls.find(([event]) => {
      return event === 'theme:isDark';
    });

    expect(isDarkHandler).toBeDefined();

    if (isDarkHandler) {
      nativeTheme.themeSource = 'dark';
      expect(isDarkHandler[1](event)).toEqual(true);
    }
  });

  test('Should change the themeSource in theme:toggle', () => {
    const toggleHandler = ipcMainMO.handle.mock.calls.find(([event]) => {
      return event === 'theme:toggle';
    });

    expect(toggleHandler).toBeDefined();

    if (toggleHandler) {
      nativeTheme.themeSource = 'light';
      toggleHandler[1](event, 'dark');
      expect(nativeTheme.themeSource).toEqual('dark');
    }
  });

  test('Should return the themeSource in theme:mode', () => {
    const modeHandler = ipcMainMO.handle.mock.calls.find(([event]) => {
      return event === 'theme:mode';
    });

    expect(modeHandler).toBeDefined();

    if (modeHandler) {
      nativeTheme.themeSource = 'light';
      expect(modeHandler[1](event)).toEqual('light');
    }
  });
});

describe('sendUpdateThemeEventTo', () => {
  test('Should send the theme:update event to the window', () => {
    vi.mocked(nativeTheme.listenerCount).mockReturnValueOnce(0);
    sendUpdateThemeEventTo(new BrowserWindow());

    const nativeThemeMO = nativeTheme as unknown as MockedObject<Electron.NativeTheme>;

    nativeThemeMO.on.mock.calls[0][1]();

    expect(BrowserWindow.prototype.webContents.send).toHaveBeenCalledWith('theme:update', {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      themeSource: nativeTheme.themeSource,
    });
  });
});

describe('removeListeners', () => {
  test('Should remove all nativeTheme listeners for updated event', () => {
    removeListeners();

    const nativeThemeMO = nativeTheme as unknown as MockedObject<Electron.NativeTheme>;

    nativeThemeMO.on.mock.calls[0][1]();

    expect(nativeTheme.removeAllListeners).toHaveBeenCalledWith('updated');
  });
});
