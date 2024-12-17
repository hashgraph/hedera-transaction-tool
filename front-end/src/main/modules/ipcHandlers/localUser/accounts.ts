import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccounts,
} from '@main/services/localUser/accounts';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Accounts */
  createIPCChannel('accounts', [
    renameFunc(addAccount, 'add'),
    renameFunc(getAccounts, 'getAll'),
    renameFunc(changeAccountNickname, 'changeNickname'),
    renameFunc(removeAccounts, 'remove'),
  ]);
};
