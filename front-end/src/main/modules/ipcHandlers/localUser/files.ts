import {
  addFile,
  getFiles,
  removeFiles,
  showStoredFileInTemp,
  updateFile,
} from '@main/services/localUser/files';
import { decodeProto } from '@main/utils/hederaSpecialFiles';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Files */
  createIPCChannel('files', [
    renameFunc(addFile, 'add'),
    renameFunc(getFiles, 'getAll'),
    renameFunc(updateFile, 'update'),
    renameFunc(removeFiles, 'remove'),
    showStoredFileInTemp,
    decodeProto,
  ]);
};
