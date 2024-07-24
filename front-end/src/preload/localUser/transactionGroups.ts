import { ipcRenderer } from 'electron';

import { GroupItem, Prisma, TransactionGroup } from '@prisma/client';

export default {
  transactionGroups: {
    getGroups: (findArgs: Prisma.TransactionGroupFindManyArgs): Promise<TransactionGroup[]> =>
      ipcRenderer.invoke('transactionGroups:getGroups', findArgs),
    getGroup: (id: string): Promise<TransactionGroup> =>
      ipcRenderer.invoke('transactionGroups:getGroup', id),
    getGroupItem: (id: string, seq: string): Promise<GroupItem> =>
      ipcRenderer.invoke('transactionGroups:getGroupItem', id, seq),
    addGroup: (group: Prisma.TransactionGroupUncheckedCreateInput): Promise<TransactionGroup> =>
      ipcRenderer.invoke('transactionGroups:addGroup', group),
    addGroupItem: (groupItem: Prisma.GroupItemUncheckedCreateInput): Promise<GroupItem> =>
      ipcRenderer.invoke('transactionGroups:addGroupItem', groupItem),
    updateGroup: (id: string, group: Prisma.TransactionGroupUncheckedUpdateInput): Promise<void> =>
      ipcRenderer.invoke('transactionGroups:updateGroup', id, group),
    getGroupItems: (id: string): Promise<GroupItem[]> =>
      ipcRenderer.invoke('transactionGroups:getGroupItems', id),
    deleteGroup: (id: string): Promise<void> =>
      ipcRenderer.invoke('transactionGroups:deleteGroup', id),
    getGroupsCount: (userId: string): Promise<number> =>
      ipcRenderer.invoke('transactionGroups:getGroupsCount', userId),
    editGroupItem: (groupItem: GroupItem): Promise<void> =>
      ipcRenderer.invoke('transactionGroups:editGroupItem', groupItem),
  },
};
