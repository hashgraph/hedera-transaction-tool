import AccountInfoVue from './components/Account/AccountInfo.vue';
import ApproveHbarAllowanceVue from './components/Account/ApproveHbarAllowance.vue';
import CreateAccount from './components/Account/CreateAccount.vue';
import DeleteAccount from './components/Account/DeleteAccount.vue';
import UpdateAccount from './components/Account/UpdateAccount.vue';
import AppendToFileVue from './components/File/AppendToFile.vue';
import CreateFile from './components/File/CreateFile.vue';
import ReadFile from './components/File/ReadFile.vue';
import UpdateFile from './components/File/UpdateFile.vue';
import FreezeVue from './components/Misc/Freeze.vue';
import TransferHbar from './components/Transfer/TransferHbar.vue';

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
  [transactionTypeKeys.createAccount]: CreateAccount,
  [transactionTypeKeys.updateAccount]: UpdateAccount,
  [transactionTypeKeys.deleteAccount]: DeleteAccount,
  [transactionTypeKeys.accountInfo]: AccountInfoVue,
  [transactionTypeKeys.transfer]: TransferHbar,
  [transactionTypeKeys.approveAllowance]: ApproveHbarAllowanceVue,
  [transactionTypeKeys.freeze]: FreezeVue,
};

export default txTypeComponentMapping;
