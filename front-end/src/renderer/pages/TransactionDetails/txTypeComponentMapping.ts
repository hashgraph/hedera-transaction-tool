import AccountCreateDetails from './compontents/AccountCreateDetails.vue';

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
  // [transactionTypeKeys.createFile]: AccountCreateDetails,
  // [transactionTypeKeys.readFile]: ReadFile,
  // [transactionTypeKeys.updateFile]: UpdateFile,
  // [transactionTypeKeys.appendToFile]: AppendToFileVue,
  [transactionTypeKeys.createAccount]: AccountCreateDetails,
  // [transactionTypeKeys.updateAccount]: UpdateAccount,
  // [transactionTypeKeys.deleteAccount]: DeleteAccount,
  // [transactionTypeKeys.accountInfo]: AccountInfoVue,
  // [transactionTypeKeys.transfer]: TransferHbar,
  // [transactionTypeKeys.approveAllowance]: ApproveHbarAllowanceVue,
  // [transactionTypeKeys.freeze]: FreezeVue,
};

export default txTypeComponentMapping;
