import axios from 'axios';

/* User service for organization */

const userController = 'user';

export const getUserState = async (
  serverUrl: string,
  accessToken: string,
): Promise<{
  passwordTemporary: boolean;
  secretHashes: string[];
}> => {
  try {
    // const { data } = await axios.get(`${serverUrl}/${userController}/state`, {
    //   headers: {
    //     Authorization: `Bearer ${accessToken}`,
    //   },
    // });

    // return data;

    return {
      passwordTemporary: true,
      secretHashes: [],
    };
  } catch (error: any) {
    throw new Error('Failed get user state');
  }
};
