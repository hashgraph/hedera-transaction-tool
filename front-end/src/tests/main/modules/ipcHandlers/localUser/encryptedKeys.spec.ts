import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler, invokeIPCListener } from '../../../_utils_';

import registerEncryptedKeysHandlers from '@main/modules/ipcHandlers/localUser/encryptedKeys';
import {
  getFileStreamEventEmitter,
  searchEncryptedKeysAbort,
  EncryptedKeysSearcher,
  Abortable,
  decryptPrivateKeyFromPath,
} from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers EncryptedKeys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerEncryptedKeysHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['searchEncryptedKeys', 'decryptEncryptedKey'];
    expect(events.every(util => getIPCHandler(`encryptedKeys:${util}`))).toBe(true);
  });

  test('Should set up searchEncryptedKeys handler', async () => {
    const filePaths = ['/path/to/file1.pem', '/path/to/file2.pem'];
    const searchResult = ['result1', 'result2'];

    const searcherMock = {
      search: vi.fn().mockResolvedValue(searchResult),
    };
    vi.mocked(EncryptedKeysSearcher).mockImplementation(() => searcherMock as any);

    await invokeIPCHandler('encryptedKeys:searchEncryptedKeys', filePaths);
    expect(EncryptedKeysSearcher).toHaveBeenCalledWith(expect.any(Abortable), ['.pem']);
    expect(searcherMock.search).toHaveBeenCalledWith(filePaths);
  });

  test('Should set up searchEncryptedKeys:abort handler', () => {
    const eventEmitterMock = {
      emit: vi.fn(),
    };
    vi.mocked(getFileStreamEventEmitter).mockReturnValue(eventEmitterMock as any);

    invokeIPCListener('encryptedKeys:searchEncryptedKeys:abort');
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(searchEncryptedKeysAbort);
  });

  test('Should set up decryptEncryptedKey handler', async () => {
    const filePath = '/path/to/file.pem';
    const password = 'password';
    const skipIndexes = [1, 2];
    const skipHashCode = 12345;

    await invokeIPCHandler(
      'encryptedKeys:decryptEncryptedKey',
      filePath,
      password,
      skipIndexes,
      skipHashCode,
    );
    expect(decryptPrivateKeyFromPath).toHaveBeenCalledWith(
      filePath,
      password,
      skipIndexes,
      skipHashCode,
    );
  });
});
