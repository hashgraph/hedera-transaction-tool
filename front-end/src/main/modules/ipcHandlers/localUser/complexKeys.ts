import {
  addComplexKey,
  getComplexKeys,
  getComplexKey,
  deleteComplexKey,
  updateComplexKey,
} from '@main/services/localUser/complexKeys';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Complex Keys */
  createIPCChannel('complexKeys', [
    renameFunc(addComplexKey, 'add'),
    renameFunc(getComplexKeys, 'getAll'),
    getComplexKey,
    renameFunc(updateComplexKey, 'update'),
    renameFunc(deleteComplexKey, 'delete'),
  ]);
};
