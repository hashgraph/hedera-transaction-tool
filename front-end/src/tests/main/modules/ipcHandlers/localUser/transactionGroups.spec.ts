import { ipcMain } from 'electron';

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
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  addGroup: vi.fn(),
  addGroupItem: vi.fn(),
  getGroup: vi.fn(),
  getGroups: vi.fn(),
  getGroupsCount: vi.fn(),
  getGroupItems: vi.fn(),
  deleteGroup: vi.fn(),
  editGroupItem: vi.fn(),
  getGroupItem: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroupItem: vi.fn(),
}));

describe('IPC handlers transaction groups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerTransactionGroupsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

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

    expect(
      events.every(e =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `transactionGroups:${e}`),
      ),
    ).toBe(true);
  });

  test('Should set up getGroups handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionGroups:getGroups');
    expect(handler).toBeDefined();

    const findArgs: Prisma.TransactionGroupFindManyArgs = { where: { id: 'userId' } };

    handler && (await handler[1](event, findArgs));
    expect(getGroups).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getGroup handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionGroups:getGroup');
    expect(handler).toBeDefined();

    const id = 'groupId';

    handler && (await handler[1](event, id));
    expect(getGroup).toHaveBeenCalledWith(id);
  });

  test('Should set up getGroupItem handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:getGroupItem',
    );
    expect(handler).toBeDefined();

    const id = 'groupId';
    const seq = '1';

    handler && (await handler[1](event, id, seq));
    expect(getGroupItem).toHaveBeenCalledWith(id, seq);
  });

  test('Should set up addGroup handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionGroups:addGroup');
    expect(handler).toBeDefined();

    const transactionGroup: Prisma.TransactionGroupUncheckedCreateInput = {
      description: 'description',
      atomic: false,
    };

    handler && (await handler[1](event, transactionGroup));
    expect(addGroup).toHaveBeenCalledWith(transactionGroup);
  });

  test('Should set up updateGroup handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:updateGroup',
    );
    expect(handler).toBeDefined();

    const id = 'groupId';
    const group: Prisma.TransactionGroupUncheckedUpdateInput = {
      description: 'new description',
      atomic: true,
    };

    handler && (await handler[1](event, id, group));
    expect(updateGroup).toHaveBeenCalledWith(id, group);
  });

  test('Should set up addGroupItem handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:addGroupItem',
    );
    expect(handler).toBeDefined();

    const groupItem: Prisma.GroupItemUncheckedCreateInput = {
      transaction_group_id: 'groupId',
      seq: '1',
      transaction_draft_id: 'draftId',
    };

    handler && (await handler[1](event, groupItem));
    expect(addGroupItem).toHaveBeenCalledWith(groupItem);
  });

  test('Should set up getGroupItems handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:getGroupItems',
    );
    expect(handler).toBeDefined();

    const id = 'groupId';

    handler && (await handler[1](event, id));
    expect(getGroupItems).toHaveBeenCalledWith(id);
  });

  test('Should set up getGroupsCount handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:getGroupsCount',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';

    handler && (await handler[1](event, userId));
    expect(getGroupsCount).toHaveBeenCalledWith(userId);
  });

  test('Should set up deleteGroup handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:deleteGroup',
    );
    expect(handler).toBeDefined();

    const id = 'groupId';

    handler && (await handler[1](event, id));
    expect(deleteGroup).toHaveBeenCalledWith(id);
  });

  test('Should set up editGroupItem handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:editGroupItem',
    );
    expect(handler).toBeDefined();

    const groupItem: GroupItem = {
      transaction_group_id: 'groupId',
      seq: '1',
      transaction_draft_id: 'draftId',
      transaction_id: 'txId',
    };

    handler && (await handler[1](event, groupItem));
    expect(editGroupItem).toHaveBeenCalledWith(groupItem);
  });

  test('Should set up deleteGroupItem handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionGroups:deleteGroupItem',
    );
    expect(handler).toBeDefined();

    const id = 'groupId';
    const seq = '1';

    handler && (await handler[1](event, id, seq));
    expect(deleteGroupItem).toHaveBeenCalledWith(id, seq);
  });
});
