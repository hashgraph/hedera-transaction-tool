import {
  addAccount,
  changeAccountNickname,
  getAccounts,
  removeAccounts,
  getAccountById,
} from '@main/services/localUser/accounts';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Accounts */
  createIPCChannel('accounts', [
    renameFunc(addAccount, 'add'),
    renameFunc(getAccounts, 'getAll'),
    renameFunc(getAccountById, 'getOne'),
    renameFunc(changeAccountNickname, 'changeNickname'),
    renameFunc(removeAccounts, 'remove'),
  ]);
};
