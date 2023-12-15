import CreateAccount from './components/Account/CreateAccount.vue';
import UpdateAccount from './components/Account/UpdateAccount.vue';
import CreateFile from './components/File/CreateFile.vue';
import ReadFile from './components/File/ReadFile.vue';
import UpdateFile from './components/File/UpdateFile.vue';

const txTypeComponentMapping = {
  createFile: CreateFile,
  readFile: ReadFile,
  updateFile: UpdateFile,
  createAccount: CreateAccount,
  updateAccount: UpdateAccount,
};

export default txTypeComponentMapping;
