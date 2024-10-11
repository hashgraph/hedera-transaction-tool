import ApproveHbarAllowance from './ApproveHbarAllowance';
import AccountCreate from './AccountCreate';
import AccountUpdate from './AccountUpdate';
import AccountDelete from './AccountDelete';
import FileAppend from './FileAppend';
import FileCreate from './FileCreate';
import FileUpdate from './FileUpdate';
import ReadFile from './File/ReadFile.vue';
import FreezeVue from './Misc/Freeze.vue';
import TransferHbar from './Transfer/TransferHbar.vue';

export const transactionTypeKeys = {
  createFile: 'FileCreateTransaction',
  readFile: 'FileContentsQuery',
  updateFile: 'FileUpdateTransaction',
  appendToFile: 'FileAppendTransaction',
  createAccount: 'AccountCreateTransaction',
  updateAccount: 'AccountUpdateTransaction',
  deleteAccount: 'AccountDeleteTransaction',
  accountInfo: 'AccountInfoQuery',
  transfer: 'TransferTransaction',
  approveAllowance: 'AccountAllowanceApproveTransaction',
  freeze: 'FreezeTransaction',
};

const txTypeComponentMapping = {
  [transactionTypeKeys.createFile]: FileCreate,
  [transactionTypeKeys.readFile]: ReadFile,
  [transactionTypeKeys.updateFile]: FileUpdate,
  [transactionTypeKeys.appendToFile]: FileAppend,
  [transactionTypeKeys.createAccount]: AccountCreate,
  [transactionTypeKeys.updateAccount]: AccountUpdate,
  [transactionTypeKeys.deleteAccount]: AccountDelete,
  [transactionTypeKeys.transfer]: TransferHbar,
  [transactionTypeKeys.approveAllowance]: ApproveHbarAllowance,
  [transactionTypeKeys.freeze]: FreezeVue,
};

export default txTypeComponentMapping;
