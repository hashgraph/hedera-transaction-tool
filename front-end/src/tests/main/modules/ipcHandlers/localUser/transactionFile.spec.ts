import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerTransactionFileHandlers from '@main/modules/ipcHandlers/localUser/transactionFile';

import { readTransactionFile, writeTransactionFile } from '@main/utils/transactionFile';

vi.mock('@main/utils/transactionFile', () => mockDeep());

describe('IPC handlers transactionFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerTransactionFileHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['readTransactionFile', 'writeTransactionFile'];
    expect(events.every(e => getIPCHandler(`transactionFile:${e}`))).toBe(true);
  });

  test('Should set up readTransactionFile handler', async () => {
    const filePath = '/path/to/file.tx';

    await invokeIPCHandler('transactionFile:readTransactionFile', filePath);
    expect(readTransactionFile).toHaveBeenCalledWith(filePath);
  });

  test('Should set up writeTransactionFile handler', async () => {
    const transactionFile = { someField: 'value' } as any;
    const filePath = '/path/to/file.tx';

    await invokeIPCHandler('transactionFile:writeTransactionFile', transactionFile, filePath);
    expect(writeTransactionFile).toHaveBeenCalledWith(transactionFile, filePath);
  });
});
