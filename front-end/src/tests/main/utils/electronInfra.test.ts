import { mockDeep } from 'vitest-mock-extended';

import { ipcMain } from 'electron';
import { renameFunc, createIPCChannel } from '@main/utils/electronInfra';

vi.mock('electron', () => {
  return {
    ipcMain: mockDeep<Electron.IpcMain>(),
  };
});

describe('renameFunc', () => {
  test('should rename the function', () => {
    const originalFunc = vi.fn();
    const newName = 'newFuncName';
    const renamedFunc = renameFunc(originalFunc, newName);

    expect(renamedFunc.name).toBe(newName);
  });

  test('should call the original function with correct arguments', async () => {
    const originalFunc = vi.fn();
    const renamedFunc = renameFunc(originalFunc, 'newFuncName');
    const args = [1, 2, 3];

    await renamedFunc(...args);

    expect(originalFunc).toHaveBeenCalledWith(...args);
  });
});

describe('createIPCChannel', () => {
  const ipcMainMO = vi.mocked(ipcMain);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('should create IPC handlers with correct names', () => {
    const handler1 = () => {};
    const handler2 = () => {};

    const channelName = 'testChannel';

    createIPCChannel(channelName, [handler1, handler2]);

    expect(ipcMainMO.handle).toHaveBeenCalledWith(`${channelName}:handler1`, expect.any(Function));
    expect(ipcMainMO.handle).toHaveBeenCalledWith(`${channelName}:handler2`, expect.any(Function));
  });

  test('should throw an error if handler does not have a name', () => {
    const channelName = 'testChannel';

    expect(() => createIPCChannel(channelName, [() => {}])).toThrow('IPC handler must have a name');
  });

  test('should call the handler with correct arguments', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');

    const handler = vi.fn().mockName('handler');
    const channelName = 'testChannel';
    const args = [1, 2, 3];

    const senderFrame = {
      url: process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173',
    };

    const event = {
      senderFrame,
      sender: {
        mainFrame: senderFrame,
      },
    } as unknown as Electron.IpcMainInvokeEvent;

    createIPCChannel(channelName, [handler]);

    const ipcHandler = ipcMainMO.handle.mock.calls[0][1];
    ipcHandler(event, ...args);

    expect(handler).toHaveBeenCalledWith(...args);
  });
});
