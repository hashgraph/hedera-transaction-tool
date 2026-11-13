import type { IReviewerStoreChanges, IReviewerStoreState } from '@shared/interfaces';

import { ipcRenderer } from 'electron';

export default {
  reviewerStore: {
    getState: (organizationId: string): Promise<IReviewerStoreState> =>
      ipcRenderer.invoke('reviewerStore:getState', organizationId),
    applyChanges: (organizationId: string, changes: IReviewerStoreChanges): Promise<void> =>
      ipcRenderer.invoke('reviewerStore:applyChanges', organizationId, changes),
  },
};
