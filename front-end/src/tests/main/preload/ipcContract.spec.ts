/**
 * Contract between the preload API (renderer side) and the registered IPC handlers (main side).
 *
 * Every function the preload exposes is called, and the channel it sends on is recorded. Each such
 * channel must have a handler registered by the main process. This catches a renamed or removed
 * handler (or a typo'd channel in the preload) for every API, without starting Electron.
 */
const ipc = vi.hoisted(() => ({
  handled: new Set<string>(),
  listened: new Set<string>(),
  invoked: new Set<string>(),
  sent: new Set<string>(),
  exposed: new Map<string, any>(),
}));

vi.mock('electron', () => ({
  nativeTheme: { themeSource: 'system', shouldUseDarkColors: false, on: vi.fn() },
  app: { getPath: vi.fn(() => ''), getVersion: vi.fn(() => ''), on: vi.fn(), isPackaged: false },
  BrowserWindow: { getAllWindows: vi.fn(() => []), fromWebContents: vi.fn() },
  dialog: {},
  shell: {},
  safeStorage: {},
  session: {},
  Menu: {},
  screen: {},
  ipcMain: {
    handle: (channel: string) => ipc.handled.add(channel),
    on: (channel: string) => ipc.listened.add(channel),
    once: (channel: string) => ipc.listened.add(channel),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: (channel: string) => {
      ipc.invoked.add(channel);
      return Promise.resolve();
    },
    send: (channel: string) => void ipc.sent.add(channel),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => {
      ipc.exposed.set(key, api);
    },
  },
}));

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false }, electronApp: {}, optimizer: {} }));

import registerAllHandlers from '@main/modules/ipcHandlers';

function collectFunctions(node: unknown, path: string[] = []): Array<[string, () => unknown]> {
  if (typeof node === 'function') return [[path.join('.'), node as () => unknown]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => collectFunctions(v, [...path, k]));
  }
  return [];
}

describe('preload <-> main IPC contract', () => {
  beforeAll(async () => {
    registerAllHandlers();
    await import('../../../preload');

    const api = ipc.exposed.get('electronAPI');
    for (const [, fn] of collectFunctions(api)) {
      try {
        await fn();
      } catch {
        // Arguments are not provided; only the channel the call reaches matters.
      }
    }
  });

  test('exposes electronAPI to the renderer', () => {
    expect(ipc.exposed.get('electronAPI')).toBeDefined();
    expect(Object.keys(ipc.exposed.get('electronAPI').local)).toContain('accounts');
  });

  test('calls at least some channels (guards against the walk silently doing nothing)', () => {
    expect(ipc.invoked.size).toBeGreaterThan(50);
  });

  test('every channel the preload invokes has a registered ipcMain.handle handler', () => {
    const missing = [...ipc.invoked].filter(c => !ipc.handled.has(c)).sort();
    expect(missing).toEqual([]);
  });

  test('every channel the preload sends on has a registered ipcMain listener', () => {
    const missing = [...ipc.sent].filter(c => !ipc.listened.has(c)).sort();
    expect(missing).toEqual([]);
  });
});
