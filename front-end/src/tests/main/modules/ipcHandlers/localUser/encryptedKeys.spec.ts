import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerEncryptedKeysHandlers from '@main/modules/ipcHandlers/localUser/encryptedKeys';
import { decryptPrivateKeyFromPath, searchEncryptedKeys, abortEncryptedKeySearch } from '@main/services/localUser';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers EncryptedKeys', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerEncryptedKeysHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['searchEncryptedKeys', 'searchEncryptedKeys:abort', 'decryptEncryptedKey'];
    expect(events.every(util => getIPCHandler(`encryptedKeys:${util}`))).toBe(true);
  });

  test('Should set up searchEncryptedKeys handler', async () => {
    const filePaths = ['/path/to/file1.pem', '/path/to/file2.pem'];
    const searchResult = ['result1', 'result2'];

    vi.mocked(searchEncryptedKeys).mockResolvedValue(searchResult);

    const result = await invokeIPCHandler('encryptedKeys:searchEncryptedKeys', filePaths);

    expect(searchEncryptedKeys).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual(searchResult);
  });

  test('Should abort the encrypted keys search', () => {
    invokeIPCHandler('encryptedKeys:searchEncryptedKeys:abort');
    expect(abortEncryptedKeySearch).toHaveBeenCalled();
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
