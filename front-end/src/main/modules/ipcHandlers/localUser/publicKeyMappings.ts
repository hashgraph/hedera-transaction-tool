import {
  getPublicKeys,
  addPublicKey,
  getPublicKey,
  updatePublicKeyNickname,
  deletePublicKey,
} from '@main/services/localUser/publicKeyMapping';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  createIPCChannel('publicKeyMapping', [
    renameFunc(getPublicKeys, 'getAll'),
    renameFunc(addPublicKey, 'add'),
    renameFunc(getPublicKey, 'get'),
    renameFunc(updatePublicKeyNickname, 'updateNickname'),
    renameFunc(deletePublicKey, 'delete'),
  ]);
};
