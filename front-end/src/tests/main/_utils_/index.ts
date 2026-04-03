import { mockDeep } from 'vitest-mock-extended';

import { ipcMain } from 'electron';

vi.mock('electron', () => {
  const mocked = mockDeep<typeof import('electron')>();
  // Provide a real return value for app.getPath so that modules calling
  // createLogger at import-time (which uses path.join(app.getPath(...)))
  // don't fail with a proxy object.
  mocked.app.getPath.mockReturnValue('/tmp/test');
  return mocked;
});

const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

export const getIPCHandler = (name: string) => {
  const handler = vi.mocked(ipcMain).handle.mock.calls.find(([e]) => e === name);
  expect(handler).toBeDefined();

  if (!handler) {
    throw new Error(`Handler for ${name} is not defined`);
  }

  return handler;
};

export const getIPCListener = (name: string) => {
  const listener = vi.mocked(ipcMain).on.mock.calls.find(([e]) => e === name);
  expect(listener).toBeDefined();

  if (!listener) {
    throw new Error(`Listener for ${name} is not defined`);
  }

  return listener;
};

export const invokeIPCHandler = async (name: string, ...args: any[]) => {
  const handler = getIPCHandler(name);
  return await handler[1](event, ...args);
};

export const invokeIPCListener = (name: string, ...args: any[]) => {
  const listener = getIPCListener(name);
  listener[1](event, ...args);
};
