/* eslint-disable @typescript-eslint/no-unused-vars */
import type { MockedClass, MockedObject } from 'vitest';
import { vi } from 'vitest';

import { restoreOrCreateWindow } from '@main/windows/mainWindow';

import { BrowserWindow } from 'electron';

/**
 * Mock real electron BrowserWindow API
 */
vi.mock('electron', () => {
  // Use "as unknown as" because vi.fn() does not have static methods
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;
  bw.getAllWindows = vi.fn(() => bw.mock.instances);
  bw.prototype.loadURL = vi.fn((_: string, __?: Electron.LoadURLOptions) => Promise.resolve());
  bw.prototype.loadFile = vi.fn((_: string, __?: Electron.LoadFileOptions) => Promise.resolve());
  // Use "any" because the on function is overloaded

  const callbacks = {
    'ready-to-show': vi.fn(),
    closed: vi.fn(),
  };

  bw.prototype.on = vi.fn<any>((e, c) => {
    callbacks[e as keyof typeof callbacks] = c;
  }) as any;
  bw.prototype.destroy = vi.fn();
  bw.prototype.isDestroyed = vi.fn();
  bw.prototype.isMinimized = vi.fn();
  bw.prototype.focus = vi.fn();
  bw.prototype.restore = vi.fn();
  bw.prototype.close = vi.fn(() => {
    callbacks.closed && callbacks.closed();
  });
  bw.prototype.emit = vi.fn();
  bw.prototype.show = vi.fn();
  bw.prototype.restore = vi.fn(() => {
    callbacks['ready-to-show'] && callbacks['ready-to-show']();
  });

  Object.defineProperty(bw.prototype, 'webContents', {
    value: {
      openDevTools: vi.fn(),
    },
    writable: false,
    enumerable: true,
  });

  const app: Pick<Electron.App, 'getAppPath'> = {
    getAppPath(): string {
      return '';
    },
  };

  const screen: Pick<Electron.Screen, 'getPrimaryDisplay'> = {
    getPrimaryDisplay() {
      const display: Electron.Display = {
        accelerometerSupport: 'unknown',
        bounds: {
          x: 1,
          y: 2,
          width: 1000,
          height: 1000,
        },
        colorDepth: 2,
        colorSpace: '2',
        depthPerComponent: 2,
        detected: true,
        displayFrequency: 2,
        id: 2,
        internal: true,
        label: 'Main',
        maximumCursorSize: {
          height: 2,
          width: 1,
        },
        monochrome: true,
        nativeOrigin: {
          x: 1,
          y: 2,
        },
        rotation: 2,
        scaleFactor: 2,
        size: {
          width: 1000,
          height: 1000,
        },
        touchSupport: 'unknown',
        workArea: {
          x: 1,
          y: 2,
          width: 1000,
          height: 1000,
        },
        workAreaSize: {
          width: 1000,
          height: 1000,
        },
      };
      return display;
    },
  };

  const nativeTheme = {
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    listenerCount: vi.fn(),
  };

  const session = {
    fromPartition: vi.fn(),
  };

  return {
    BrowserWindow: bw,
    app,
    screen,
    nativeTheme,
    session,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

test('Should create a new window', async () => {
  const { mock } = vi.mocked(BrowserWindow);
  expect(mock.instances).toHaveLength(0);

  await restoreOrCreateWindow();

  expect(mock.instances).toHaveLength(1);
  const instance = mock.instances[0] as MockedObject<BrowserWindow>;
  const loadURLCalls = instance.loadURL.mock.calls.length;
  const loadFileCalls = instance.loadFile.mock.calls.length;
  expect(loadURLCalls + loadFileCalls).toBe(1);
  if (loadURLCalls === 1) {
    expect(instance.loadURL).toHaveBeenCalledWith(expect.stringMatching(/index\.html$/));
  } else {
    expect(instance.loadFile).toHaveBeenCalledWith(expect.stringMatching(/index\.html$/));
  }
});

test('Should restore an existing window', async () => {
  const { mock } = vi.mocked(BrowserWindow);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const appWindow = vi.mocked(mock.instances[0]);
  appWindow.isMinimized.mockReturnValueOnce(true);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  expect(appWindow.restore).toHaveBeenCalledOnce();
});

test('Should create a new window if the previous one was destroyed', async () => {
  const { mock } = vi.mocked(BrowserWindow);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const appWindow = vi.mocked(mock.instances[0]);
  appWindow.isDestroyed.mockReturnValueOnce(true);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(2);
});

test('Should set differnet VITE_PUBLIC', async () => {
  const prevVITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  //@ts-expect-error read-only property
  process.env.VITE_DEV_SERVER_URL = 'http://localhost:3000';

  const { mock } = vi.mocked(BrowserWindow);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(1);
  const appWindow = vi.mocked(mock.instances[0]);
  appWindow.isDestroyed.mockReturnValueOnce(true);

  await restoreOrCreateWindow();
  expect(mock.instances).toHaveLength(2);

  //@ts-expect-error read-only property
  process.env.VITE_DEV_SERVER_URL = prevVITE_DEV_SERVER_URL;
});

test('Should send theme event after ready-to-show emitted with already shown event ', async () => {
  const window = await restoreOrCreateWindow();

  window.close();
  window.restore();
});
