import CreateAccount from './components/Account/CreateAccount.vue';
import DeleteAccount from './components/Account/DeleteAccount.vue';
import UpdateAccount from './components/Account/UpdateAccount.vue';
import CreateFile from './components/File/CreateFile.vue';
import ReadFile from './components/File/ReadFile.vue';
import UpdateFile from './components/File/UpdateFile.vue';
import TransferHbar from './components/Transfer/TransferHbar.vue';

const txTypeComponentMapping = {
  createFile: CreateFile,
  readFile: ReadFile,
  updateFile: UpdateFile,
  createAccount: CreateAccount,
  updateAccount: UpdateAccount,
  deleteAccount: DeleteAccount,
  transferHbar: TransferHbar,
};

export default txTypeComponentMapping;
