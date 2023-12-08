import CreateFile from './components/CreateFile.vue';
import ReadFileVue from './components/ReadFile.vue';
import UpdateFileVue from './components/UpdateFile.vue';

const txTypeComponentMapping = {
  createFile: CreateFile,
  readFile: ReadFileVue,
  updateFile: UpdateFileVue,
};

export default txTypeComponentMapping;
