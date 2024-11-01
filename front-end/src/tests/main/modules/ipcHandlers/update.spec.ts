import { MockedObject } from 'vitest';

import registerUpdateListeners from '@main/modules/ipcHandlers/update';
import { Updater } from '@main/services/update';

import { ipcMain } from 'electron';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => {
  return {
    app: {
      getVersion: () => '1.0.0',
    },
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn(),
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
    const onEventNames = ['check-for-update'];
    const handleEventNames = ['get-version'];

    expect(
      onEventNames.every(util =>
        ipcMainMO.on.mock.calls.some(([channel]) => channel === `update:${util}`),
      ),
    ).toBe(true);

    expect(
      handleEventNames.every(util =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `update:${util}`),
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

  test('Should get version', async () => {
    const getVersionHandler = ipcMainMO.handle.mock.calls.find(([event]) => {
      return event === 'update:get-version';
    });

    expect(getVersionHandler).toBeDefined();

    if (getVersionHandler) {
      const result = getVersionHandler[1](event);
      expect(result).toBe('1.0.0');
    }
  });
});
