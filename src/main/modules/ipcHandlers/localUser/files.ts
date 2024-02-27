import { ipcMain } from 'electron';

import {
  addFile,
  getFiles,
  removeFile,
  showContentInTemp,
  updateFile,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';

const createChannelName = (...props) => ['files', ...props].join(':');

export default () => {
  /* Files */

  // Get all
  ipcMain.handle(createChannelName('getAll'), (_e, userId: string) => getFiles(userId));

  // Add
  ipcMain.handle(createChannelName('add'), (_e, file: Prisma.HederaFileUncheckedCreateInput) =>
    addFile(file),
  );

  // Update
  ipcMain.handle(
    createChannelName('update'),
    (_e, fileId: string, userId: string, file: Prisma.HederaFileUncheckedUpdateInput) =>
      updateFile(fileId, userId, file),
  );

  // Remove
  ipcMain.handle(createChannelName('remove'), (_e, userId: string, fileId: string) =>
    removeFile(userId, fileId),
  );

  // Show in temp folder
  ipcMain.handle(createChannelName('showContentInTemp'), (_e, userId: string, fileId: string) =>
    showContentInTemp(userId, fileId),
  );
};
