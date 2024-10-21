import AccountInfoVue from './components/Account/AccountInfo.vue';
import ApproveHbarAllowanceVue from './components/Account/ApproveHbarAllowance.vue';
import CreateAccount from './components/Account/CreateAccount.vue';
import DeleteAccount from './components/Account/DeleteAccount.vue';
import UpdateAccount from './components/Account/UpdateAccount.vue';
import AppendToFileVue from './components/File/AppendToFile.vue';
import CreateFile from './components/File/CreateFile.vue';
import ReadFile from './components/File/ReadFile.vue';
import UpdateFile from './components/File/UpdateFile.vue';
import FreezeVue from './components/Node/Freeze.vue';
import TransferHbar from './components/Transfer/TransferHbar.vue';
import NodeCreate from './components/Node/NodeCreate.vue';
import NodeDelete from './components/Node/NodeDelete.vue';
import NodeUpdate from './components/Node/NodeUpdate.vue';

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
  nodeCreate: 'NodeCreate',
  nodeDelete: 'NodeDelete',
  nodeUpdate: 'NodeUpdate'
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
  [transactionTypeKeys.nodeCreate]: NodeCreate,
  [transactionTypeKeys.nodeDelete]: NodeDelete,
  [transactionTypeKeys.nodeUpdate]: NodeUpdate,
};

export default txTypeComponentMapping;
