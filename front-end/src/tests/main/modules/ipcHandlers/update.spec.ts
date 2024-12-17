import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, getIPCListener, invokeIPCHandler, invokeIPCListener } from '../../_utils_';

import registerUpdateListeners from '@main/modules/ipcHandlers/update';
import { app } from 'electron';
import { Updater } from '@main/services/update';

vi.mock('@main/services/localUser/update', () => mockDeep());

describe('registerUpdateListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerUpdateListeners();
  });

  test('Should register handlers for each update event', () => {
    const onEventNames = ['check-for-update'];
    const handleEventNames = ['get-version'];

    expect(onEventNames.every(util => getIPCListener(`update:${util}`))).toBe(true);
    expect(handleEventNames.every(util => getIPCHandler(`update:${util}`))).toBe(true);
  });

  test('Should start checking for updates', async () => {
    vi.spyOn(Updater, 'checkForUpdate');

    await invokeIPCListener('update:check-for-update');

    expect(Updater.checkForUpdate).toBeCalledTimes(1);
  });

  test('Should get version', async () => {
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');

    const result = await invokeIPCHandler('update:get-version');

    expect(result).toBe('1.0.0');
  });
});
