import { getAccessToken, getOrganization } from '../localUser';

export * from './auth';
export * from './user';
export * from './userKeys';

export const getRequestMeta = async (userId: string, organizationId: string) => {
  const organization = await getOrganization(organizationId);
  const accessToken = await getAccessToken(organizationId, userId);

  if (!organization || !accessToken) {
    throw new Error('Organization or access token not found');
  }

  return { organization, accessToken };
};
