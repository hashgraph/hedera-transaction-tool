import type {
  ICreateReviewerGroupRequest,
  IDeleteReviewerGroupRequest,
  IGroupChangeRecord,
  IReviewerGroupDetail,
  IReviewerGroupSummary,
  IUpdateReviewerGroupRequest,
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

// Same pending-change behavior as deleteReviewerGroup: proposes an UPDATE change record
// rather than applying it immediately, pending member attestation. All fields besides
// userKeyId/userSignature are optional on the back-end DTO (partial update), but this
// client always sends the full form state.
export const updateReviewerGroup = (
  organizationServerUrl: string,
  id: number,
  dto: IUpdateReviewerGroupRequest,
): Promise<IGroupChangeRecord> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.patch(`${organizationServerUrl}/${controller}/${id}`, dto);
    return response.data;
  }, 'Failed to update reviewer group');
