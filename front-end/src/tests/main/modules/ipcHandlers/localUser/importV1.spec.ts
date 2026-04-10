import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerImportV1Handlers from '@main/modules/ipcHandlers/localUser/importV1';

import { filterForImportV1 } from '@main/services/localUser/importV1';

vi.mock('@main/services/localUser/importV1', () => mockDeep());

describe('IPC handlers importV1', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerImportV1Handlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['filterForImportV1'];
    expect(events.every(e => getIPCHandler(`importV1:${e}`))).toBe(true);
  });

  test('Should set up filterForImportV1 handler', async () => {
    const filePaths = ['/path/to/file.zip'];

    await invokeIPCHandler('importV1:filterForImportV1', filePaths);
    expect(filterForImportV1).toHaveBeenCalledWith(filePaths);
  });
});
