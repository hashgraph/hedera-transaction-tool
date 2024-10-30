import ApproveHbarAllowance from './ApproveHbarAllowance';
import AccountCreate from './AccountCreate';
import AccountUpdate from './AccountUpdate';
import AccountDelete from './AccountDelete';
import FileAppend from './FileAppend';
import FileCreate from './FileCreate';
import FileUpdate from './FileUpdate';
import FileContents from './FileContents';
import Freeze from './Freeze';
import TransferHbar from './TransferHbar';
import NodeCreate from './NodeCreate';
import NodeDelete from './NodeDelete';
import NodeUpdate from './NodeUpdate';
import SystemDelete from './SystemDelete';

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
  nodeCreate: 'NodeCreateTransaction',
  nodeDelete: 'NodeDeleteTransaction',
  nodeUpdate: 'NodeUpdateTransaction',
  systemDelete: 'SystemDeleteTransaction',
};

const txTypeComponentMapping = {
  [transactionTypeKeys.createFile]: FileCreate,
  [transactionTypeKeys.readFile]: FileContents,
  [transactionTypeKeys.updateFile]: FileUpdate,
  [transactionTypeKeys.appendToFile]: FileAppend,
  [transactionTypeKeys.createAccount]: AccountCreate,
  [transactionTypeKeys.updateAccount]: AccountUpdate,
  [transactionTypeKeys.deleteAccount]: AccountDelete,
  [transactionTypeKeys.transfer]: TransferHbar,
  [transactionTypeKeys.approveAllowance]: ApproveHbarAllowance,
  [transactionTypeKeys.freeze]: Freeze,
  [transactionTypeKeys.nodeCreate]: NodeCreate,
  [transactionTypeKeys.nodeDelete]: NodeDelete,
  [transactionTypeKeys.nodeUpdate]: NodeUpdate,
  [transactionTypeKeys.systemDelete]: SystemDelete,
};

export default txTypeComponentMapping;
