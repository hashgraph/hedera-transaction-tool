import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerLoggingHandlers from '@main/modules/ipcHandlers/localUser/logging';

import { logRendererMessage } from '@main/modules/logger';

vi.mock('@main/modules/logger', () => mockDeep());

describe('IPC handlers Logging', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerLoggingHandlers();
  });

  test('Should register handlers for each event', () => {
    expect(getIPCHandler('logging:log')).toBeTruthy();
  });

  test('Should set up logRendererMessage handler', async () => {
    const level = 'info';
    const message = 'test message';
    await invokeIPCHandler('logging:log', level, message);
    expect(logRendererMessage).toHaveBeenCalledWith(level, message);
  });
});
