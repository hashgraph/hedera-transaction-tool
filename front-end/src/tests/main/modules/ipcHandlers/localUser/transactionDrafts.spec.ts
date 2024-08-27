import { ipcMain } from 'electron';

import registerContactsHandlers from '@main/modules/ipcHandlers/localUser/transactionDrafts';
import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  getDraftsCount,
  updateDraft,
} from '@main/services/localUser';
import { Prisma } from '@prisma/client';
import { MockedObject } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}));

vi.mock('@main/services/localUser', () => ({
  addDraft: vi.fn(),
  deleteDraft: vi.fn(),
  draftExists: vi.fn(),
  getDraft: vi.fn(),
  getDrafts: vi.fn(),
  getDraftsCount: vi.fn(),
  updateDraft: vi.fn(),
}));

describe('IPC handlers transaction drafts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerContactsHandlers();
  });

  const ipcMainMO = ipcMain as unknown as MockedObject<Electron.IpcMain>;
  const event: Electron.IpcMainEvent = mockDeep<Electron.IpcMainEvent>();

  test('Should register handlers for each event', () => {
    const event = [
      'getDrafts',
      'getDraft',
      'addDraft',
      'updateDraft',
      'deleteDraft',
      'draftExists',
      'getDraftsCount',
    ];

    expect(
      event.every(e =>
        ipcMainMO.handle.mock.calls.some(([channel]) => channel === `transactionDrafts:${e}`),
      ),
    ).toBe(true);
  });

  test('Should set up getDrafts handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionDrafts:getDrafts');
    expect(handler).toBeDefined();

    const findArgs: Prisma.TransactionDraftFindManyArgs = { where: { user_id: 'userId' } };

    handler && (await handler[1](event, findArgs));
    expect(getDrafts).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getDraft handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionDrafts:getDraft');
    expect(handler).toBeDefined();

    const id = 'draftId';

    handler && (await handler[1](event, id));
    expect(getDraft).toHaveBeenCalledWith(id);
  });

  test('Should set up addDraft handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(([e]) => e === 'transactionDrafts:addDraft');
    expect(handler).toBeDefined();

    const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
      user_id: 'userId',
      type: 'someType',
      transactionBytes: 'transactionBytes',
      description: 'description',
    };

    handler && (await handler[1](event, transactionDraft));
    expect(addDraft).toHaveBeenCalledWith(transactionDraft);
  });

  test('Should set up updateDraft handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionDrafts:updateDraft',
    );
    expect(handler).toBeDefined();

    const id = 'draftId';
    const transactionDraft: Prisma.TransactionDraftUncheckedUpdateInput = {
      transactionBytes: 'updatedTransactionBytes',
    };

    handler && (await handler[1](event, id, transactionDraft));
    expect(updateDraft).toHaveBeenCalledWith(id, transactionDraft);
  });

  test('Should set up deleteDraft handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionDrafts:deleteDraft',
    );
    expect(handler).toBeDefined();

    const id = 'draftId';

    handler && (await handler[1](event, id));
    expect(deleteDraft).toHaveBeenCalledWith(id);
  });

  test('Should set up draftExists handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionDrafts:draftExists',
    );
    expect(handler).toBeDefined();

    const transactionBytes = 'transactionBytes';

    handler && (await handler[1](event, transactionBytes));
    expect(draftExists).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up getDraftsCount handler', async () => {
    const handler = ipcMainMO.handle.mock.calls.find(
      ([e]) => e === 'transactionDrafts:getDraftsCount',
    );
    expect(handler).toBeDefined();

    const userId = 'userId';

    handler && (await handler[1](event, userId));
    expect(getDraftsCount).toHaveBeenCalledWith(userId);
  });
});
