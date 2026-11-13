import type { IReviewerSyncFailure } from '@shared/interfaces';

import { planReviewerSync, type IReviewerSyncSource } from '@shared/utils/reviewerSync';

import { getReviewerGroup, getReviewerGroups } from '@renderer/services/organization/reviewerGroups';
import { getReviewerRules } from '@renderer/services/organization/reviewerRules';
import { applyReviewerChanges, getReviewerState } from '@renderer/services/reviewerStoreService';

/* Reviewer Sync Service */

// Brings the local reviewer store up to date with the organization server: fetched here and
// handed to the main process, which writes them in one transaction. A group whose detail
// couldn't be fetched is left as it was locally and comes back in `failures` so the caller
// can alert the user.
export const syncReviewerGroups = async (
  organizationId: string,
  serverUrl: string,
): Promise<IReviewerSyncFailure[]> => {
  const source: IReviewerSyncSource = {
    listGroups: () => getReviewerGroups(serverUrl),
    getGroup: groupId => getReviewerGroup(serverUrl, groupId),
    listRules: () => getReviewerRules(serverUrl),
  };

  const local = await getReviewerState(organizationId);
  const { failures, ...changes } = await planReviewerSync(local, source);

  const hasChanges = Object.values(changes).some(list => list.length > 0);
  if (hasChanges) await applyReviewerChanges(organizationId, changes);

  return failures;
};
