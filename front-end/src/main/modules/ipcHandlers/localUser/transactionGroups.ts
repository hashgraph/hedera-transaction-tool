import { ipcMain } from 'electron';

import { GroupItem, Prisma } from '@prisma/client';

import {
  addGroup,
  addGroupItem,
  getGroup,
  getGroups,
  getGroupsCount,
  getGroupItems,
  deleteGroup,
  editGroupItem,
  getGroupItem,
  updateGroup,
  deleteGroupItem,
} from '@main/services/localUser';

const createChannelName = (...props) => ['transactionGroups', ...props].join(':');

export default () => {
  // Get Groups
  ipcMain.handle(
    createChannelName('getGroups'),
    (_e, findArgs: Prisma.TransactionGroupFindManyArgs) => getGroups(findArgs),
  );
  // Get Group
  ipcMain.handle(createChannelName('getGroup'), (_e, id: string) => getGroup(id));
  // Get Group Item
  ipcMain.handle(createChannelName('getGroupItem'), (_e, id: string, seq: string) =>
    getGroupItem(id, seq),
  );
  // Add a group
  ipcMain.handle(
    createChannelName('addGroup'),
    (_e, transactionGroup: Prisma.TransactionGroupUncheckedCreateInput) =>
      addGroup(transactionGroup),
  );
  // Udpate group
  ipcMain.handle(
    createChannelName('updateGroup'),
    (_e, id: string, group: Prisma.TransactionGroupUncheckedUpdateInput) => updateGroup(id, group),
  );
  // Add a group item
  ipcMain.handle(
    createChannelName('addGroupItem'),
    (_e, groupItem: Prisma.GroupItemUncheckedCreateInput) => addGroupItem(groupItem),
  );
  // Get a group item
  ipcMain.handle(createChannelName('getGroupItems'), (_e, id: string) => getGroupItems(id));

  // Get drafts count
  ipcMain.handle(createChannelName('getGroupsCount'), (_e, userId: string) =>
    getGroupsCount(userId),
  );

  ipcMain.handle(createChannelName('deleteGroup'), (_e, id: string) => deleteGroup(id));

  ipcMain.handle(createChannelName('editGroupItem'), (_e, groupItem: GroupItem) =>
    editGroupItem(groupItem),
  );

  ipcMain.handle(createChannelName('deleteGroupItem'), (_e, id: string, seq: string) =>
    deleteGroupItem(id, seq),
  );
};
