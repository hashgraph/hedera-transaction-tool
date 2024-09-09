import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import { ipcMain } from 'electron';

import registerEncryptedKeysHandlers from '@main/modules/ipcHandlers/localUser/encryptedKeys';
import {
  getFileStreamEventEmitter,
  searchEncryptedKeysAbort,
  EncryptedKeysSearcher,
  Abortable,
  decryptPrivateKeyFromPath,
} from '@main/services/localUser';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), on: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  getFileStreamEventEmitter: vi.fn(),
  searchEncryptedKeysAbort: 'searchEncryptedKeysAbort',
  EncryptedKeysSearcher: vi.fn(),
  Abortable: vi.fn(),
  decryptPrivateKeyFromPath: vi.fn(),
}));

describe('IPC handlers EncryptedKeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerEncryptedKeysHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should set up searchEncryptedKeys handler', async () => {
    const searchEncryptedKeysHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'encryptedKeys:searchEncryptedKeys',
    );
    expect(searchEncryptedKeysHandler).toBeDefined();

    const filePaths = ['/path/to/file1.pem', '/path/to/file2.pem'];
    const searchResult = ['result1', 'result2'];

    const searcherMock = {
      search: vi.fn().mockResolvedValue(searchResult),
    };
    vi.mocked(EncryptedKeysSearcher).mockImplementation(() => searcherMock as any);

    searchEncryptedKeysHandler && (await searchEncryptedKeysHandler[1](event, filePaths));
    expect(EncryptedKeysSearcher).toHaveBeenCalledWith(expect.any(Abortable), ['.pem']);
    expect(searcherMock.search).toHaveBeenCalledWith(filePaths);
  });

  test('Should set up searchEncryptedKeys:abort handler', () => {
    const searchEncryptedKeysAbortHandler = ipcMainMO.on.mock.calls.find(
      ([e]) => e === 'encryptedKeys:searchEncryptedKeys:abort',
    );
    expect(searchEncryptedKeysAbortHandler).toBeDefined();

    const eventEmitterMock = {
      emit: vi.fn(),
    };
    vi.mocked(getFileStreamEventEmitter).mockReturnValue(eventEmitterMock as any);

    searchEncryptedKeysAbortHandler &&
      searchEncryptedKeysAbortHandler[1](
        'some-event-structure' as unknown as Electron.IpcMainEvent,
      );
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(searchEncryptedKeysAbort);
  });

  test('Should set up decryptEncryptedKey handler', async () => {
    const decryptEncryptedKeyHandler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'encryptedKeys:decryptEncryptedKey',
    );
    expect(decryptEncryptedKeyHandler).toBeDefined();

    const filePath = '/path/to/file.pem';
    const password = 'password';
    const skipIndexes = [1, 2];
    const skipHashCode = 12345;
    const decryptedKey = { privateKey: 'privateKey', index: null, recoveryPhraseHashCode: null };

    vi.mocked(decryptPrivateKeyFromPath).mockResolvedValue(decryptedKey);

    decryptEncryptedKeyHandler &&
      (await decryptEncryptedKeyHandler[1](event, filePath, password, skipIndexes, skipHashCode));
    expect(decryptPrivateKeyFromPath).toHaveBeenCalledWith(
      filePath,
      password,
      skipIndexes,
      skipHashCode,
    );
  });
});
