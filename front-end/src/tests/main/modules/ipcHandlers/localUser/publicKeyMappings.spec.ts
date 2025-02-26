import { mockDeep } from 'vitest-mock-extended';
import { getIPCHandler, invokeIPCHandler, invokeIPCListener } from '../../../_utils_';

import registerPublicKeyMappingsHandlers from '@main/modules/ipcHandlers/localUser/publicKeyMappings';
import {
  getFileStreamEventEmitterPublic,
  searchPublicKeysAbort,
  PublicKeySearcher,
  PublicAbortable,
  getPublicKeys,
  addPublicKey,
  getPublicKey,
  updatePublicKeyNickname,
  deletePublicKey,
} from '@main/services/localUser/publicKeyMapping';

vi.mock('@main/services/localUser/publicKeyMapping', () => mockDeep());

describe('IPC handlers PublicKeyMappings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerPublicKeyMappingsHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = ['getAll', 'add', 'get', 'updateNickname', 'delete', 'searchPublicKeys'];
    expect(events.every(util => getIPCHandler(`publicKeyMapping:${util}`))).toBe(true);
  });

  test('Should set up searchPublicKeys handler', async () => {
    const filePaths = ['/path/to/file1.pub', '/path/to/file2.pub'];
    const searchResult = [
      { publicKey: 'publicKey1', nickname: 'file1' },
      { publicKey: 'publicKey2', nickname: 'file2' },
    ];

    const searcherMock = {
      search: vi.fn().mockResolvedValue(searchResult),
    };
    vi.mocked(PublicKeySearcher).mockImplementation(() => searcherMock as any);

    await invokeIPCHandler('publicKeyMapping:searchPublicKeys', filePaths);
    expect(PublicKeySearcher).toHaveBeenCalledWith(expect.any(PublicAbortable));
    expect(searcherMock.search).toHaveBeenCalledWith(filePaths);
  });

  test('Should set up searchPublicKeys:abort handler', () => {
    const eventEmitterMock = {
      emit: vi.fn(),
    };
    vi.mocked(getFileStreamEventEmitterPublic).mockReturnValue(eventEmitterMock as any);

    invokeIPCListener('publicKeyMapping:searchPublicKeys:abort');
    expect(eventEmitterMock.emit).toHaveBeenCalledWith(searchPublicKeysAbort);
  });

  test('Should set up getAll handler', async () => {
    const storedKeys = [{ id: '1', public_key: 'publicKey1', nickname: 'key1' }];
    vi.mocked(getPublicKeys).mockResolvedValue(storedKeys);

    const result = await invokeIPCHandler('publicKeyMapping:getAll');
    expect(getPublicKeys).toHaveBeenCalled();
    expect(result).toEqual(storedKeys);
  });

  test('Should set up add handler', async () => {
    const newKey = { publicKey: 'publicKey1', nickname: 'key1' };
    const storedKey = { id: '1', public_key: 'publicKey1', nickname: 'key1' };

    vi.mocked(addPublicKey).mockResolvedValue(storedKey);

    const result = await invokeIPCHandler(
      'publicKeyMapping:add',
      newKey.publicKey,
      newKey.nickname,
    );
    expect(addPublicKey).toHaveBeenCalledWith(newKey.publicKey, newKey.nickname);
    expect(result).toEqual(storedKey);
  });

  test('Should set up get handler', async () => {
    const storedKey = { id: '1', public_key: 'publicKey1', nickname: 'key1' };
    vi.mocked(getPublicKey).mockResolvedValue(storedKey);

    const result = await invokeIPCHandler('publicKeyMapping:get', 'publicKey1');
    expect(getPublicKey).toHaveBeenCalledWith('publicKey1');
    expect(result).toEqual(storedKey);
  });

  test('Should set up updateNickname handler', async () => {
    const updatedKey = { id: '1', public_key: 'publicKey1', nickname: 'updatedKey' };

    vi.mocked(updatePublicKeyNickname).mockResolvedValue(updatedKey);

    const result = await invokeIPCHandler('publicKeyMapping:updateNickname', '1', 'updatedKey');
    expect(updatePublicKeyNickname).toHaveBeenCalledWith('1', 'updatedKey');
    expect(result).toEqual(updatedKey);
  });

  test('Should set up delete handler', async () => {
    vi.mocked(deletePublicKey).mockResolvedValue(true as any);

    const result = await invokeIPCHandler('publicKeyMapping:delete', '1');
    expect(deletePublicKey).toHaveBeenCalledWith('1');
    expect(result).toBeTruthy();
  });
});
