import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

import registerTransactionGroupsHandlers from '@main/modules/ipcHandlers/localUser/transactionGroups';
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
import { Prisma, GroupItem } from '@prisma/client';

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers transaction groups', () => {
  const groupId = 'groupId';
  const userId = 'userId';
  const seq = '1';

  beforeEach(() => {
    vi.resetAllMocks();
    registerTransactionGroupsHandlers();
  });

  test('Should register handlers for each event', () => {
    const events = [
      'getGroups',
      'getGroup',
      'getGroupItem',
      'addGroup',
      'updateGroup',
      'addGroupItem',
      'getGroupItems',
      'getGroupsCount',
      'deleteGroup',
      'editGroupItem',
      'deleteGroupItem',
    ];

    expect(events.every(e => getIPCHandler(`transactionGroups:${e}`))).toBe(true);
  });

  test('Should set up getGroups handler', async () => {
    const findArgs: Prisma.TransactionGroupFindManyArgs = { where: { id: 'userId' } };

    await invokeIPCHandler('transactionGroups:getGroups', findArgs);
    expect(getGroups).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getGroup handler', async () => {
    await invokeIPCHandler('transactionGroups:getGroup', groupId);
    expect(getGroup).toHaveBeenCalledWith(groupId);
  });

  test('Should set up getGroupItem handler', async () => {
    await invokeIPCHandler('transactionGroups:getGroupItem', groupId, seq);
    expect(getGroupItem).toHaveBeenCalledWith(groupId, seq);
  });

  test('Should set up addGroup handler', async () => {
    const transactionGroup: Prisma.TransactionGroupUncheckedCreateInput = {
      description: 'description',
      atomic: false,
    };

    await invokeIPCHandler('transactionGroups:addGroup', transactionGroup);
    expect(addGroup).toHaveBeenCalledWith(transactionGroup);
  });

  test('Should set up updateGroup handler', async () => {
    const group: Prisma.TransactionGroupUncheckedUpdateInput = {
      description: 'new description',
      atomic: true,
    };

    await invokeIPCHandler('transactionGroups:updateGroup', groupId, group);
    expect(updateGroup).toHaveBeenCalledWith(groupId, group);
  });

  test('Should set up addGroupItem handler', async () => {
    const groupItemCreate: Prisma.GroupItemUncheckedCreateInput = {
      transaction_group_id: 'groupId',
      seq: '1',
      transaction_draft_id: 'draftId',
    };

    await invokeIPCHandler('transactionGroups:addGroupItem', groupItemCreate);
    expect(addGroupItem).toHaveBeenCalledWith(groupItemCreate);
  });

  test('Should set up getGroupItems handler', async () => {
    await invokeIPCHandler('transactionGroups:getGroupItems', groupId);
    expect(getGroupItems).toHaveBeenCalledWith(groupId);
  });

  test('Should set up getGroupsCount handler', async () => {
    await invokeIPCHandler('transactionGroups:getGroupsCount', userId);
    expect(getGroupsCount).toHaveBeenCalledWith(userId);
  });

  test('Should set up deleteGroup handler', async () => {
    await invokeIPCHandler('transactionGroups:deleteGroup', groupId);
    expect(deleteGroup).toHaveBeenCalledWith(groupId);
  });

  test('Should set up editGroupItem handler', async () => {
    const groupItemEdit: GroupItem = {
      transaction_group_id: 'groupId',
      seq: '1',
      transaction_draft_id: 'draftId',
      transaction_id: 'txId',
    };

    await invokeIPCHandler('transactionGroups:editGroupItem', groupItemEdit);
    expect(editGroupItem).toHaveBeenCalledWith(groupItemEdit);
  });

  test('Should set up deleteGroupItem handler', async () => {
    await invokeIPCHandler('transactionGroups:deleteGroupItem', groupId, seq);
    expect(deleteGroupItem).toHaveBeenCalledWith(groupId, seq);
  });
});
