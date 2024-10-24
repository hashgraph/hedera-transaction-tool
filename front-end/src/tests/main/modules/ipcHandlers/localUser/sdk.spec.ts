import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

import registerSDKHandlers from '@main/modules/ipcHandlers/localUser/sdk';

import { getNodeAddressBook } from '@main/services/localUser';
import { ipcMain } from 'electron';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  getNodeAddressBook: vi.fn(),
}));

describe('IPC handlers SDK', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerSDKHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const events = ['getNodeAddressBook'];

    expect(
      events.every(e => ipcMainMO.handle.mock.calls.some(([channel]) => channel === `sdk:${e}`)),
    ).toBe(true);
  });

  test('Should set up getNodeAddressBook handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'sdk:getNodeAddressBook');
    expect(handler).toBeDefined();

    const mirrorNetwork = 'some-network';

    handler && (await handler[1](event, mirrorNetwork));
    expect(getNodeAddressBook).toHaveBeenCalledWith(mirrorNetwork);
  });
});
