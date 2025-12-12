import { getIPCHandler, invokeIPCHandler } from '../../_utils_';

import registerUpdateListeners from '@main/modules/ipcHandlers/update';
import { app } from 'electron';

describe('registerUpdateListeners', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerUpdateListeners();
  });

  test('Should register get-version handler', () => {
    const handleEventNames = ['get-version'];

    expect(handleEventNames.every(util => getIPCHandler(`update:${util}`))).toBe(true);
  });

  test('Should get version', async () => {
    vi.mocked(app.getVersion).mockReturnValue('1.0.0');

    const result = await invokeIPCHandler('update:get-version');

    expect(result).toBe('1.0.0');
  });
});
