import { applyReviewerChanges, getReviewerState } from '@main/services/localUser';
import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';

export default () => {
  /* Reviewer store */
  createIPCChannel('reviewerStore', [
    renameFunc(getReviewerState, 'getState'),
    renameFunc(applyReviewerChanges, 'applyChanges'),
  ]);
};
