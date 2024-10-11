import AccountInfoVue from './Account/AccountInfo.vue';
import ApproveHbarAllowanceVue from './Account/ApproveHbarAllowance.vue';
import AccountCreate from './AccountCreate';
import AccountUpdate from './AccountUpdate';
import DeleteAccount from './Account/DeleteAccount.vue';
import AppendToFileVue from './File/AppendToFile.vue';
import CreateFile from './File/CreateFile.vue';
import ReadFile from './File/ReadFile.vue';
import UpdateFile from './File/UpdateFile.vue';
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
  [transactionTypeKeys.createFile]: CreateFile,
  [transactionTypeKeys.readFile]: ReadFile,
  [transactionTypeKeys.updateFile]: UpdateFile,
  [transactionTypeKeys.appendToFile]: AppendToFileVue,
  [transactionTypeKeys.createAccount]: AccountCreate,
  [transactionTypeKeys.updateAccount]: AccountUpdate,
  [transactionTypeKeys.deleteAccount]: DeleteAccount,
  [transactionTypeKeys.accountInfo]: AccountInfoVue,
  [transactionTypeKeys.transfer]: TransferHbar,
  [transactionTypeKeys.approveAllowance]: ApproveHbarAllowanceVue,
  [transactionTypeKeys.freeze]: FreezeVue,
};

export default txTypeComponentMapping;
