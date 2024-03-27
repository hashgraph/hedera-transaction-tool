import axios from 'axios';

import { getRequestMeta } from '.';

/* User keys service for organization */

const controller = ['user', 'keys'];

/* Get user keys from organization */
export const getOwn = async (organizationId: string, userId: string) => {
  try {
    const { organization, accessToken } = await getRequestMeta(userId, organizationId);

    const response = await axios.get(
      `${organization?.serverUrl}/${controller[0]}/${userId}/${controller[1]}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return response.data;
  } catch (error: any) {
    console.log(error);

    throw new Error('Failed get user keys');
  }
};
