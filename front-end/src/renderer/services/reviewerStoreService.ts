import type { IReviewerStoreChanges } from '@shared/interfaces';

import { commonIPCHandler } from '@renderer/utils';

/* Reviewer Store Service: the locally-held, verified reviewer groups and rules */

export const getReviewerState = async (organizationId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.reviewerStore.getState(organizationId);
  }, 'Failed to read the local reviewer state');

export const applyReviewerChanges = async (
  organizationId: string,
  changes: IReviewerStoreChanges,
) =>
  commonIPCHandler(async () => {
    await window.electronAPI.local.reviewerStore.applyChanges(organizationId, changes);
  }, 'Failed to update the local reviewer state');
