import AccountApproveAllowanceDetails from './AccountApproveAllowanceDetails.vue';
import AccountDetails from './AccountDetails.vue';
import DeleteAccountDetails from './DeleteAccountDetails.vue';
import FileDetails from './FileDetails.vue';
import FreezeDetails from './FreezeDetails.vue';
import NodeDetails from './NodeDetails.vue';
import SystemDetails from './SystemDetails.vue';
import TransferDetails from './TransferDetails.vue';

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
  systemDelete: 'SystemDeleteTransaction',
  systemUndelete: 'SystemUndeleteTransaction',
  nodeCreate: 'NodeCreateTransaction',
  nodeUpdate: 'NodeUpdateTransaction',
  nodeDelete: 'NodeDeleteTransaction',
};

const txTypeComponentMapping = {
  [transactionTypeKeys.createFile]: FileDetails,
  [transactionTypeKeys.updateFile]: FileDetails,
  [transactionTypeKeys.appendToFile]: FileDetails,
  [transactionTypeKeys.createAccount]: AccountDetails,
  [transactionTypeKeys.updateAccount]: AccountDetails,
  [transactionTypeKeys.deleteAccount]: DeleteAccountDetails,
  [transactionTypeKeys.transfer]: TransferDetails,
  [transactionTypeKeys.approveAllowance]: AccountApproveAllowanceDetails,
  [transactionTypeKeys.freeze]: FreezeDetails,
  [transactionTypeKeys.systemDelete]: SystemDetails,
  [transactionTypeKeys.systemUndelete]: SystemDetails,
  [transactionTypeKeys.nodeCreate]: NodeDetails,
  [transactionTypeKeys.nodeUpdate]: NodeDetails,
  [transactionTypeKeys.nodeDelete]: NodeDetails,
};

export default txTypeComponentMapping;
