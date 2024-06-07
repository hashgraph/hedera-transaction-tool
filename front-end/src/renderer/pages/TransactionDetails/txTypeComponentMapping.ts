import AccountApproveAllowanceDetails from './compontents/AccountApproveAllowanceDetails.vue';
import AccountDetails from './compontents/AccountDetails.vue';
import DeleteAccountDetails from './compontents/DeleteAccountDetails.vue';
import FileDetails from './compontents/FileDetails.vue';
import FreezeDetails from './compontents/FreezeDetails.vue';
import TransferDetails from './compontents/TransferDetails.vue';

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
  [transactionTypeKeys.createFile]: FileDetails,
  [transactionTypeKeys.updateFile]: FileDetails,
  [transactionTypeKeys.appendToFile]: FileDetails,
  [transactionTypeKeys.createAccount]: AccountDetails,
  [transactionTypeKeys.updateAccount]: AccountDetails,
  [transactionTypeKeys.deleteAccount]: DeleteAccountDetails,
  [transactionTypeKeys.transfer]: TransferDetails,
  [transactionTypeKeys.approveAllowance]: AccountApproveAllowanceDetails,
  [transactionTypeKeys.freeze]: FreezeDetails,
};

export default txTypeComponentMapping;
