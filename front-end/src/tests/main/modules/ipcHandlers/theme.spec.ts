import { getIPCHandler, invokeIPCHandler } from '../../_utils_';

import registerThemeListeners, {
  removeListeners,
  sendUpdateThemeEventTo,
} from '@main/modules/ipcHandlers/theme';

import { BrowserWindow, nativeTheme } from 'electron';

describe('registerThemeListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerThemeListeners();
  });

  test('Should register handlers for each theme event', () => {
    const eventNames = ['isDark', 'toggle', 'mode'];
    expect(eventNames.every(util => getIPCHandler(`theme:${util}`))).toBe(true);
  });

  test("Should return the nativeTheme's value in theme:isDark", async () => {
    Object.defineProperty(nativeTheme, 'shouldUseDarkColors', { value: true });
    expect(await invokeIPCHandler('theme:isDark')).toEqual(true);
  });

  test('Should change the themeSource in theme:toggle', async () => {
    Object.defineProperty(nativeTheme, 'themeSource', { value: 'light' });
    await invokeIPCHandler('theme:toggle', 'dark');
    expect(nativeTheme.themeSource).toEqual('dark');
  });

  test('Should return the themeSource in theme:mode', async () => {
    nativeTheme.themeSource = 'light';
    expect(await invokeIPCHandler('theme:mode')).toEqual('light');
  });
});

describe('sendUpdateThemeEventTo', () => {
  test('Should send the theme:update event to the window', () => {
    vi.mocked(nativeTheme.listenerCount).mockReturnValueOnce(0);
    const window = {
      webContents: {
        send: vi.fn(),
      },
    } as unknown as BrowserWindow;

    sendUpdateThemeEventTo(window);

    vi.mocked(nativeTheme).on.mock.calls[0][1]();

    expect(window.webContents.send).toHaveBeenCalledWith('theme:update', {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      themeSource: nativeTheme.themeSource,
    });
  });
});

describe('removeListeners', () => {
  test('Should remove all nativeTheme listeners for updated event', () => {
    removeListeners();

    vi.mocked(nativeTheme).on.mock.calls[0][1]();

    expect(nativeTheme.removeAllListeners).toHaveBeenCalledWith('updated');
  });
});
