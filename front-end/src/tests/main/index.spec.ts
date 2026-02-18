import { mockDeep } from 'vitest-mock-extended';

import { app, BrowserWindow, session } from 'electron';
import { optimizer, is } from '@electron-toolkit/utils';

import initDatabase from '@main/db/init';

import initLogger from '@main/modules/logger';
import createMenu from '@main/modules/menu';
import handleDeepLink, { PROTOCOL_NAME } from '@main/modules/deepLink';
import registerIpcListeners from '@main/modules/ipcHandlers';
import { restoreOrCreateWindow } from '@main/windows/mainWindow';
import { deleteAllTempFolders } from '@main/services/localUser';

vi.mock('path', () => mockDeep());
vi.mock('@electron-toolkit/utils', () => mockDeep());
vi.mock('electron', () => {
  const mocked = mockDeep();
  mocked.app.requestSingleInstanceLock.mockReturnValue(true);
  mocked.app.whenReady.mockResolvedValue();
  return mocked;
});
vi.mock('@main/db/init', () => mockDeep());
vi.mock('@main/services/localUser', () => mockDeep());
vi.mock('@main/modules/logger', () => mockDeep());
vi.mock('@main/modules/menu', () => mockDeep());
vi.mock('@main/modules/deepLink', () => ({
  default: vi.fn(),
  PROTOCOL_NAME: 'test-protocol',
}));
vi.mock('@main/modules/ipcHandlers', () => mockDeep());
vi.mock('@main/windows/mainWindow', () => mockDeep());

// Mock the new electronUpdater service to avoid electron-updater accessing app.getVersion()
vi.mock('@main/services/electronUpdater', () => ({
  getUpdaterService: vi.fn(() => null),
  initializeUpdaterService: vi.fn(),
}));

describe('Electron entry file', async () => {
  const processOnSpy = vi.spyOn(process, 'on');
  await import('@main/index');

  const processMessageHandler = processOnSpy.mock.calls.find(
    ([event]) => event === 'message',
  )![1] as (msg: string) => void;
  processOnSpy.mockRestore();

  const assertEventHandler = (event: string) => {
    const handler = vi.mocked(app).on.mock.calls.find(([ev]) => ev === event);

    expect(handler).toBeDefined();
    expect(handler![1]).toBeDefined();
    if (!handler) {
      throw new Error('Handler not found');
    }
    return handler[1];
  };

  vi.mocked(BrowserWindow).mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
    isMinimized: vi.fn(),
    restore: vi.fn(),
    focus: vi.fn(),
  } as unknown as BrowserWindow);

  test('Should initialize the main process', async () => {
    is.dev = false;
    vi.mocked(restoreOrCreateWindow).mockResolvedValue(new BrowserWindow());

    //@ts-expect-error Incorrect type definition
    const readyHandler = vi.mocked(app).on.mock.calls.find(([event]) => event === 'ready');
    expect(readyHandler).toBeDefined();
    expect(readyHandler![1]).toBeDefined();

    readyHandler && (await readyHandler[1]());

    expect(initLogger).toHaveBeenCalled();
    expect(initDatabase).toHaveBeenCalled();
    expect(registerIpcListeners).toHaveBeenCalled();
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith(PROTOCOL_NAME);
    expect(restoreOrCreateWindow).toHaveBeenCalled();
    expect(createMenu).toHaveBeenCalled();
    expect(session.defaultSession.webRequest.onHeadersReceived).toHaveBeenCalled();
    expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function));

    is.dev = true;
  });

  test('Should attach watcher for dev tools opener in dev mone', async () => {
    const browserWindowCreatedHandler = vi.mocked(app).on.mock.calls.find(
      //@ts-expect-error Incorrect type definition
      ([event]) => event === 'browser-window-created',
    );
    expect(browserWindowCreatedHandler).toBeDefined();
    expect(browserWindowCreatedHandler![1]).toBeDefined();

    browserWindowCreatedHandler && (await browserWindowCreatedHandler[1]());

    expect(optimizer.watchWindowShortcuts).toHaveBeenCalled();
  });

  test("Should quit the app when all windows are closed and it's not macOS", async () => {
    const windowAllClosedHandler = vi
      .mocked(app)
      .on.mock.calls.find(([event]) => event === 'window-all-closed');
    expect(windowAllClosedHandler).toBeDefined();
    expect(windowAllClosedHandler![1]).toBeDefined();

    Object.defineProperty(process, 'platform', {
      value: 'not-darwin',
    });

    windowAllClosedHandler && (await windowAllClosedHandler[1]());

    expect(app.quit).toHaveBeenCalled();

    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
  });

  test('Should delete temp folder on before-quit event', async () => {
    //@ts-expect-error Incorrect type definition
    await assertEventHandler('before-quit')({ preventDefault: vi.fn() });

    expect(deleteAllTempFolders).toHaveBeenCalledOnce();
  });

  test("Should handle deep link on 'open-url' event", async () => {
    //@ts-expect-error Incorrect type definition
    await assertEventHandler('open-url')(null, 'test-url');

    expect(handleDeepLink).toHaveBeenCalledWith(expect.any(Object), null, 'test-url');
  });

  test("Should set window to null on 'closed' event", async () => {
    const mainWindow = new BrowserWindow();
    //@ts-expect-error Incorrect type definition
    mainWindow.on.mock.calls.find(([event]) => event === 'closed')![1]();

    //@ts-expect-error Incorrect type definition
    await assertEventHandler('open-url')(null, 'test-url');

    expect(handleDeepLink).not.toHaveBeenCalledTimes(2);
  });

  test("Should init window on 'activate' event", async () => {
    await assertEventHandler('activate')();
    expect(restoreOrCreateWindow).toHaveBeenCalled();
  });

  test('Should call on headers received callback', async () => {
    //@ts-expect-error Mocked object
    const onHeadersReceivedCalls = session.defaultSession.webRequest.onHeadersReceived.mock.calls;
    const callback = vi.fn();

    expect(onHeadersReceivedCalls).toBeDefined();
    expect(onHeadersReceivedCalls[0]).toBeDefined();

    onHeadersReceivedCalls[0][0]({ responseHeaders: {} }, callback);

    expect(callback).toHaveBeenCalledWith({
      responseHeaders: {
        'Content-Security-Policy': ["script-src 'self'"],
      },
    });
  });

  test('Should request single instance lock', () => {
    expect(app.requestSingleInstanceLock).toHaveBeenCalled();
  });

  test('Should restore and focus window on second-instance event', async () => {
    const mainWindow = new BrowserWindow();
    vi.mocked(restoreOrCreateWindow).mockResolvedValue(mainWindow);

    // Re-trigger ready so mainWindow is set
    //@ts-expect-error Incorrect type definition
    const readyHandler = vi.mocked(app).on.mock.calls.find(([event]) => event === 'ready');
    readyHandler && (await readyHandler[1]());

    //@ts-expect-error Incorrect type definition
    const secondInstanceHandler = vi
      .mocked(app)
      .on.mock.calls.find(([event]) => event === 'second-instance');
    expect(secondInstanceHandler).toBeDefined();

    vi.mocked(mainWindow.isMinimized).mockReturnValue(true);
    secondInstanceHandler && (await secondInstanceHandler[1]());

    expect(mainWindow.restore).toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();
  });

  test('Should focus but not restore window on second-instance when not minimized', async () => {
    const mainWindow = new BrowserWindow();
    vi.mocked(restoreOrCreateWindow).mockResolvedValue(mainWindow);

    // Re-trigger ready so mainWindow is set
    //@ts-expect-error Incorrect type definition
    const readyHandler = vi.mocked(app).on.mock.calls.find(([event]) => event === 'ready');
    readyHandler && (await readyHandler[1]());

    //@ts-expect-error Incorrect type definition
    const secondInstanceHandler = vi
      .mocked(app)
      .on.mock.calls.find(([event]) => event === 'second-instance');
    expect(secondInstanceHandler).toBeDefined();

    vi.mocked(mainWindow.isMinimized).mockReturnValue(false);
    vi.mocked(mainWindow.restore).mockClear();
    vi.mocked(mainWindow.focus).mockClear();
    secondInstanceHandler && (await secondInstanceHandler[1]());

    expect(mainWindow.restore).not.toHaveBeenCalled();
    expect(mainWindow.focus).toHaveBeenCalled();
  });

  test('Should init mainWindow when second-instance fires and mainWindow is null', async () => {
    const mainWindow = new BrowserWindow();
    vi.mocked(restoreOrCreateWindow).mockResolvedValue(mainWindow);

    // Re-trigger ready so mainWindow is set
    //@ts-expect-error Incorrect type definition
    const readyHandler = vi.mocked(app).on.mock.calls.find(([event]) => event === 'ready');
    readyHandler && (await readyHandler[1]());

    // Trigger 'closed' event to set module-level mainWindow to null
    //@ts-expect-error Incorrect type definition
    mainWindow.on.mock.calls.find(([event]) => event === 'closed')![1]();

    // Clear mocks to verify this test's calls specifically
    vi.mocked(restoreOrCreateWindow).mockClear();
    vi.mocked(mainWindow.focus).mockClear();

    //@ts-expect-error Incorrect type definition
    const secondInstanceHandler = vi
      .mocked(app)
      .on.mock.calls.find(([event]) => event === 'second-instance');
    expect(secondInstanceHandler).toBeDefined();

    secondInstanceHandler && (await secondInstanceHandler[1]());

    expect(app.whenReady).toHaveBeenCalled();
    // initMainWindow should have been called (via restoreOrCreateWindow)
    expect(restoreOrCreateWindow).toHaveBeenCalled();
    // Should return early after initMainWindow, not reach focus
    expect(mainWindow.focus).not.toHaveBeenCalled();
  });

  test('Should reload all windows on hot-reload message', () => {
    const mockWindow1 = { webContents: { reload: vi.fn() } };
    const mockWindow2 = { webContents: { reload: vi.fn() } };
    const getAllWindowsMock = vi
      .fn()
      .mockReturnValue([mockWindow1, mockWindow2] as unknown as BrowserWindow[]);
    (BrowserWindow as unknown as Record<string, unknown>).getAllWindows = getAllWindowsMock;

    processMessageHandler('electron-vite&type=hot-reload');

    expect(mockWindow1.webContents.reload).toHaveBeenCalled();
    expect(mockWindow2.webContents.reload).toHaveBeenCalled();
  });

  test('Should not reload windows on unrelated process message', () => {
    const mockWindow = { webContents: { reload: vi.fn() } };
    const getAllWindowsMock = vi
      .fn()
      .mockReturnValue([mockWindow] as unknown as BrowserWindow[]);
    (BrowserWindow as unknown as Record<string, unknown>).getAllWindows = getAllWindowsMock;

    processMessageHandler('some-other-message');

    expect(mockWindow.webContents.reload).not.toHaveBeenCalled();
  });
});

describe('Electron entry file - single instance lock not acquired', async () => {
  vi.resetModules();

  vi.doMock('electron', () => {
    const mocked = mockDeep<typeof import('electron')>();
    mocked.app.requestSingleInstanceLock.mockReturnValue(false);
    return mocked;
  });

  vi.doMock('path', () => mockDeep());
  vi.doMock('@electron-toolkit/utils', () => mockDeep());
  vi.doMock('@main/db/init', () => mockDeep());
  vi.doMock('@main/services/localUser', () => mockDeep());
  vi.doMock('@main/modules/logger', () => mockDeep());
  vi.doMock('@main/modules/menu', () => mockDeep());
  vi.doMock('@main/modules/deepLink', () => ({
    default: vi.fn(),
    PROTOCOL_NAME: 'test-protocol',
  }));
  vi.doMock('@main/modules/ipcHandlers', () => mockDeep());
  vi.doMock('@main/windows/mainWindow', () => mockDeep());
  vi.doMock('@main/services/electronUpdater', () => ({
    getUpdaterService: vi.fn(() => null),
    initializeUpdaterService: vi.fn(),
  }));

  const { app: freshApp } = await import('electron');
  await import('@main/index');

  test('Should quit the app when single instance lock is not acquired', () => {
    expect(freshApp.quit).toHaveBeenCalled();
  });

  test('Should not set up app event handlers when lock is not acquired', () => {
    expect(freshApp.on).not.toHaveBeenCalledWith('ready', expect.any(Function));
    expect(freshApp.on).not.toHaveBeenCalledWith('second-instance', expect.any(Function));
  });
});
