import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  getDraftsCount,
  updateDraft,
} from '@main/services/localUser';
import { createIPCChannel } from '@main/utils/electronInfra';

export default () => {
  /* Transaction Drafts */
  createIPCChannel('transactionDrafts', [
    addDraft,
    getDrafts,
    getDraft,
    updateDraft,
    deleteDraft,
    draftExists,
    getDraftsCount,
  ]);
};
