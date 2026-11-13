import type {
  ICreateReviewerRuleRequest,
  IDeleteReviewerRuleRequest,
  IReviewerRule,
  IRuleChangeRecord,
} from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import axios, { type AxiosResponse } from 'axios';

const controller = 'reviewer-groups/rules';

export const getReviewerRules = (organizationServerUrl: string): Promise<IReviewerRule[]> =>
  commonRequestHandler(async () => {
    try {
      const response: AxiosResponse<IReviewerRule[]> = await axiosWithCredentials.get(
        `${organizationServerUrl}/${controller}`,
      );
      return response.data;
    } catch (error) {
      // A server that predates this feature has no reviewer-rules routes at all — treat
      // that as "no rules" rather than a sync failure, the same way a new client should
      // behave against an old backend elsewhere in this app (see cancelTransactionGroup).
      if (axios.isAxiosError(error) && error.response?.status === 404) return [];
      throw error;
    }
  }, 'Failed to get reviewer rules');

export const getReviewerRuleChanges = (
  organizationServerUrl: string,
  id: number,
): Promise<IRuleChangeRecord[]> =>
  commonRequestHandler(async () => {
    const response: AxiosResponse<IRuleChangeRecord[]> = await axiosWithCredentials.get(
      `${organizationServerUrl}/${controller}/${id}/changes`,
    );
    return response.data;
  }, 'Failed to get reviewer rule change history');

export const createReviewerRule = (
  organizationServerUrl: string,
  dto: ICreateReviewerRuleRequest,
): Promise<IReviewerRule> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(`${organizationServerUrl}/${controller}`, dto);
    return response.data;
  }, 'Failed to create reviewer rule');

// Same pending-change behavior as deleteReviewerGroup: proposes a REMOVE change record
// rather than deleting the rule immediately, pending member attestation.
export const deleteReviewerRule = (
  organizationServerUrl: string,
  id: number,
  dto: IDeleteReviewerRuleRequest,
): Promise<IRuleChangeRecord> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(
      `${organizationServerUrl}/${controller}/${id}/delete`,
      dto,
    );
    return response.data;
  }, 'Failed to delete reviewer rule');
