import axios from 'axios';

import { getRequestMeta } from '.';

/* User service for organization */

const controller = 'user';

export const getUserMe = async (organizationId: string, userId: string) => {
  try {
    const { organization, accessToken } = await getRequestMeta(userId, organizationId);

    const response = await axios.get(`${organization?.serverUrl}/${controller}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error: any) {
    throw new Error('Failed get user information');
  }
};
