import { mockDeep } from 'vitest-mock-extended';

import { ipcMain } from 'electron';

vi.mock('electron', () => ({
  ipcMain: mockDeep<Electron.IpcMain>(),
}));

const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

export const getIPCHandler = (name: string) => {
  const handler = vi.mocked(ipcMain).handle.mock.calls.find(([e]) => e === name);
  expect(handler).toBeDefined();

  if (!handler) {
    throw new Error(`Handler for ${name} is not defined`);
  }

  return handler;
};

export const invokeIPCHandler = async (name: string, ...args: any[]) => {
  const handler = getIPCHandler(name);
  await handler[1](event, ...args);
};
