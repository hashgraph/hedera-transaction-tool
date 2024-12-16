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
vi.mock('electron', () => mockDeep());
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

describe('Electron entry file', async () => {
  await import('@main/index');

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
});
