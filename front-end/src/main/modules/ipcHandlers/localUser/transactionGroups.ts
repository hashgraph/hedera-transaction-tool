import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import { addGroup } from '@main/services/localUser';

const createChannelName = (...props) => ['transactionDrafts', ...props].join(':');

export default () => {
  // Add a group
  ipcMain.handle(
    createChannelName('addGroup'),
    (_e, transactionGroup: Prisma.TransactionGroupUncheckedCreateInput) =>
      addGroup(transactionGroup),
  );
};
