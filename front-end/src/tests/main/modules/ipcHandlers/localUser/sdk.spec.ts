import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerSDKHandlers from '@main/modules/ipcHandlers/localUser/sdk';

import { getNodeAddressBook } from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers SDK', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerSDKHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['getNodeAddressBook'];
    expect(events.every(e => getIPCHandler(`sdk:${e}`))).toBe(true);
  });

  test('Should set up getNodeAddressBook handler', async () => {
    const mirrorNetwork = 'some-network';

    await invokeIPCHandler('sdk:getNodeAddressBook', mirrorNetwork);
    expect(getNodeAddressBook).toHaveBeenCalledWith(mirrorNetwork);
  });
});
