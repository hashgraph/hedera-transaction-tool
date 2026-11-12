import { mockDeep } from 'vitest-mock-extended';

import { ipcMain } from 'electron';
import { renameFunc, createIPCChannel, validateSenderFrame } from '@main/utils/electronInfra';
import { pathToFileURL } from 'node:url';
import { join } from 'path';

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

describe('validateSenderFrame', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true when sender frame matches dev server URL', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');

    const frame = {
      url: 'http://localhost:5173',
    };

    const event = {
      senderFrame: frame,
      sender: {
        mainFrame: frame,
      },
    } as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(true);
  });

  it('returns false when sender frame has a different origin', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');

    const frame = {
      url: 'http://example.com',
    };

    const event = {
      senderFrame: frame,
      sender: {
        mainFrame: frame,
      },
    } as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(false);
  });

  it('returns false when senderFrame is null', () => {
    const event = {
      senderFrame: null,
      sender: {
        mainFrame: { url: 'http://localhost:5173' },
      },
    } as unknown as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(false);
  });

  it('returns false when senderFrame is not the mainFrame', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');

    const event = {
      senderFrame: { url: 'http://localhost:5173' },
      sender: {
        mainFrame: { url: 'http://localhost:5173' },
      },
    } as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(false);
  });

  it('returns true when sender frame matches production index.html', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', '');
    vi.stubEnv('DIST', '/app/dist');

    const indexURL = pathToFileURL(join('/app/dist', 'index.html'));

    const frame = {
      url: indexURL.href,
    };

    const event = {
      senderFrame: frame,
      sender: {
        mainFrame: frame,
      },
    } as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(true);
  });

  it('returns false when production sender frame URL is outside DIST directory', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', '');
    vi.stubEnv('DIST', '/app/dist');

    const frame = {
      url: pathToFileURL('/app/other/index.html').href,
    };

    const event = {
      senderFrame: frame,
      sender: {
        mainFrame: frame,
      },
    } as Electron.IpcMainInvokeEvent;

    expect(validateSenderFrame(event)).toBe(false);
  });

  it('should throw an error when the IPC sender is unauthorized', () => {
    vi.stubEnv('VITE_DEV_SERVER_URL', 'http://localhost:5173');

    const handler = vi.fn();
    Object.defineProperty(handler, 'name', { value: 'testHandler' });

    createIPCChannel('test-channel', [handler]);

    const registeredHandler = vi.mocked(ipcMain.handle).mock.calls[0][1];

    const frame = {
      url: 'http://unauthorized.com',
    };

    const event = {
      senderFrame: frame,
      sender: {
        mainFrame: frame,
      },
    } as Electron.IpcMainInvokeEvent;

    expect(() => registeredHandler(event as any)).toThrow(
      `Unauthorized IPC sender: ${ frame.url }`,
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
