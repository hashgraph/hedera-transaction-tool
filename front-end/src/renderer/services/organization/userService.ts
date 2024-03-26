import axios from 'axios';

/* User service for organization */

const userController = 'user';

export const login = async (
  serverUrl: string,
  accessToken: string,
): Promise<{
  passwordTemporary: boolean;
  secretHashes: string[];
}> => {
  try {
    const { data } = await axios.get(`${serverUrl}/${userController}/state`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return data;
  } catch (error: any) {
    throw new Error('Failed get user state');
  }
};
