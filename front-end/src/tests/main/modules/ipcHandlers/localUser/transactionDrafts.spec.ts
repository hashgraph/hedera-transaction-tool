import { mockDeep } from 'vitest-mock-extended';

import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';

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

vi.mock('@main/services/localUser', () => mockDeep());

describe('IPC handlers transaction drafts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerContactsHandlers();
  });

  const id = 'draftId';
  const userId = 'userId';
  const transactionBytes = 'transactionBytes';

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
    expect(event.every(e => getIPCHandler(`transactionDrafts:${e}`))).toBe(true);
  });

  test('Should set up getDrafts handler', async () => {
    const findArgs: Prisma.TransactionDraftFindManyArgs = { where: { user_id: 'userId' } };

    await invokeIPCHandler('transactionDrafts:getDrafts', findArgs);
    expect(getDrafts).toHaveBeenCalledWith(findArgs);
  });

  test('Should set up getDraft handler', async () => {
    await invokeIPCHandler('transactionDrafts:getDraft', id);
    expect(getDraft).toHaveBeenCalledWith(id);
  });

  test('Should set up addDraft handler', async () => {
    const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
      user_id: 'userId',
      type: 'someType',
      transactionBytes: 'transactionBytes',
      description: 'description',
    };

    await invokeIPCHandler('transactionDrafts:addDraft', transactionDraft);
    expect(addDraft).toHaveBeenCalledWith(transactionDraft);
  });

  test('Should set up updateDraft handler', async () => {
    const transactionDraft: Prisma.TransactionDraftUncheckedUpdateInput = {
      transactionBytes: 'updatedTransactionBytes',
    };

    await invokeIPCHandler('transactionDrafts:updateDraft', id, transactionDraft);
    expect(updateDraft).toHaveBeenCalledWith(id, transactionDraft);
  });

  test('Should set up deleteDraft handler', async () => {
    await invokeIPCHandler('transactionDrafts:deleteDraft', id);
    expect(deleteDraft).toHaveBeenCalledWith(id);
  });

  test('Should set up draftExists handler', async () => {
    await invokeIPCHandler('transactionDrafts:draftExists', transactionBytes);
    expect(draftExists).toHaveBeenCalledWith(transactionBytes);
  });

  test('Should set up getDraftsCount handler', async () => {
    await invokeIPCHandler('transactionDrafts:getDraftsCount', userId);
    expect(getDraftsCount).toHaveBeenCalledWith(userId);
  });
});
