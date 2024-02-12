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

const txTypeComponentMapping = {
  createFile: CreateFile,
  readFile: ReadFile,
  updateFile: UpdateFile,
  appendToFile: AppendToFileVue,
  createAccount: CreateAccount,
  updateAccount: UpdateAccount,
  deleteAccount: DeleteAccount,
  accountInfo: AccountInfoVue,
  transferHbar: TransferHbar,
  approveHbarAllowance: ApproveHbarAllowanceVue,
  freeze: FreezeVue,
};

export default txTypeComponentMapping;
