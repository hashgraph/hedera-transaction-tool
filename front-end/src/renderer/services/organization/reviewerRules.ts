import type { ICreateReviewerRuleRequest, IReviewerRule } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

const controller = 'reviewer-groups/rules';

export const getReviewerRules = (organizationServerUrl: string): Promise<IReviewerRule[]> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get(`${organizationServerUrl}/${controller}`);
    return response.data;
  }, 'Failed to get reviewer rules');

export const createReviewerRule = (
  organizationServerUrl: string,
  dto: ICreateReviewerRuleRequest,
): Promise<IReviewerRule> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post(`${organizationServerUrl}/${controller}`, dto);
    return response.data;
  }, 'Failed to create reviewer rule');
