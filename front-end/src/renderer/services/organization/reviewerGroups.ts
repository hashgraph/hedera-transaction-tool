import type {
  ICreateReviewerGroupRequest,
  IDeleteReviewerGroupRequest,
  IGroupChangeRecord,
  IReviewerGroupDetail,
  IReviewerGroupSummary,
} from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

const controller = 'reviewer-groups';

export const getReviewerGroups = (organizationServerUrl: string): Promise<IReviewerGroupSummary[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}`);
    return response.data;
  }, 'Failed to get reviewer groups');

export const getReviewerGroup = (
  organizationServerUrl: string,
  id: number,
): Promise<IReviewerGroupDetail> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}/${id}`);
    return response.data;
  }, 'Failed to get reviewer group');

export const getReviewerGroupChanges = (
  organizationServerUrl: string,
  id: number,
): Promise<IGroupChangeRecord[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(
      `${organizationServerUrl}/${controller}/${id}/changes`,
    );
    return response.data;
  }, 'Failed to get reviewer group change history');

export const createReviewerGroup = (
  organizationServerUrl: string,
  dto: ICreateReviewerGroupRequest,
): Promise<IReviewerGroupDetail> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(`${organizationServerUrl}/${controller}`, dto);
    return response.data;
  }, 'Failed to create reviewer group');

// Proposes deletion; the back-end returns a PENDING change record, not an immediate
// delete — the group only actually disappears once a member attestation threshold is
// met (not yet possible: no vote-submission endpoint exists). Gated behind
// FEATURE_REVIEWER_ENABLED until that lands.
export const deleteReviewerGroup = (
  organizationServerUrl: string,
  id: number,
  dto: IDeleteReviewerGroupRequest,
): Promise<IGroupChangeRecord> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(
      `${organizationServerUrl}/${controller}/${id}/delete`,
      dto,
    );
    return response.data;
  }, 'Failed to delete reviewer group');
