import {
  addMnemonic,
  getMnemonics,
  removeMnemonics,
  updateMnemonic,
} from '@main/services/localUser/mnemonic';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Mnemonic */
  createIPCChannel('mnemonic', [
    renameFunc(addMnemonic, 'add'),
    renameFunc(getMnemonics, 'get'),
    renameFunc(updateMnemonic, 'update'),
    renameFunc(removeMnemonics, 'remove'),
  ]);
};
