import AccountDetails from './compontents/AccountDetails.vue';
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
  // [transactionTypeKeys.createFile]: AccountDetails,
  // [transactionTypeKeys.readFile]: ReadFile,
  // [transactionTypeKeys.updateFile]: UpdateFile,
  // [transactionTypeKeys.appendToFile]: AppendToFileVue,
  [transactionTypeKeys.createAccount]: AccountDetails,
  [transactionTypeKeys.updateAccount]: AccountDetails,
  // [transactionTypeKeys.deleteAccount]: DeleteAccount,
  // [transactionTypeKeys.accountInfo]: AccountInfoVue,
  [transactionTypeKeys.transfer]: TransferDetails,
  // [transactionTypeKeys.approveAllowance]: ApproveHbarAllowanceVue,
  // [transactionTypeKeys.freeze]: FreezeVue,
};

export default txTypeComponentMapping;
