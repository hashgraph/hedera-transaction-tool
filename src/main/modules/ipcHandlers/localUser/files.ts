import { ipcMain } from 'electron';

import { addFile, getFiles, removeFile } from '../../../services/localUser';

const createChannelName = (...props) => ['files', ...props].join(':');

export default () => {
  /* Files */

  // Get all
  ipcMain.handle(createChannelName('getAll'), (_e, userId: string) => getFiles(userId));

  // Add
  ipcMain.handle(
    createChannelName('add'),
    (_e, userId: string, fileId: string, nickname: string = '') =>
      addFile(userId, fileId, nickname),
  );

  // Remove
  ipcMain.handle(
    createChannelName('remove'),
    (_e, userId: string, fileId: string, nickname: string = '') =>
      removeFile(userId, fileId, nickname),
  );
};
