import { MockedObject } from 'vitest';

import registerUpdateListeners from '@main/modules/ipcHandlers/update';
import { Updater } from '@main/services/update';

import { ipcMain } from 'electron';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => {
  return {
    ipcMain: {
      on: vi.fn(),
    },
  };
});
vi.mock('@main/services/localUser/update');

describe('registerUpdateListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerUpdateListeners();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each update event', () => {
    const eventNames = ['check-for-update'];

    expect(
      eventNames.every(util =>
        ipcMainMO.on.mock.calls.some(([channel]) => channel === `update:${util}`),
      ),
    ).toBe(true);
  });

  test('Should start checking for updates', () => {
    const checkForUpdateHandler = ipcMainMO.on.mock.calls.find(([event]) => {
      return event === 'update:check-for-update';
    });

    expect(checkForUpdateHandler).toBeDefined();

    vi.spyOn(Updater, 'checkForUpdate');

    if (checkForUpdateHandler) {
      checkForUpdateHandler[1](event);
      expect(Updater.checkForUpdate).toBeCalledTimes(1);
    }
  });
});
