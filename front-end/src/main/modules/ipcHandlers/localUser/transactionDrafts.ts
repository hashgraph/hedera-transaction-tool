import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  getDraftsCount,
  updateDraft,
} from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Transaction Drafts */
  createIPCChannel('transactionDrafts', [
    renameFunc(addDraft, 'addDraft'),
    renameFunc(getDrafts, 'getDrafts'),
    renameFunc(getDraft, 'getDraft'),
    renameFunc(updateDraft, 'updateDraft'),
    renameFunc(deleteDraft, 'deleteDraft'),
    renameFunc(draftExists, 'draftExists'),
    renameFunc(getDraftsCount, 'getDraftsCount'),
  ]);
};
