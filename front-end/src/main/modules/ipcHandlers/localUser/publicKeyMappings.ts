import { ipcMain } from 'electron';
import {
  getPublicKeys,
  addPublicKey,
  getPublicKey,
  updatePublicKeyNickname,
  deletePublicKey,
  PublicKeySearcher,
  PublicAbortable,
  searchPublicKeysAbort,
  getFileStreamEventEmitterPublic,
} from '@main/services/localUser/publicKeyMapping';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

const createChannelName = (...props) => ['publicKeyMapping', ...props].join(':');

export default () => {
  createIPCChannel('publicKeyMapping', [
    renameFunc(getPublicKeys, 'getAll'),
    renameFunc(addPublicKey, 'add'),
    renameFunc(getPublicKey, 'get'),
    renameFunc(updatePublicKeyNickname, 'updateNickname'),
    renameFunc(deletePublicKey, 'delete'),
  ]);

  ipcMain.handle(createChannelName('searchPublicKeys'), async (_e, filePaths: string[]) => {
    const abortable = new PublicAbortable(searchPublicKeysAbort);
    const searcher = new PublicKeySearcher(abortable);
    return await searcher.search(filePaths);
  });

  ipcMain.on(createChannelName('searchPublicKeys:abort'), () => {
    getFileStreamEventEmitterPublic().emit(searchPublicKeysAbort);
  });
};
