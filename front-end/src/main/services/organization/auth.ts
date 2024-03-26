import axios from 'axios';

/* Authentification service for organization */

export const login = async (
  serverUrl: string,
  email: string,
  password: string,
): Promise<string> => {
  try {
    const response = await axios.post(`${serverUrl}/auth/signin`, {
      email,
      password,
    });

    return response.data?.accessToken || '';
  } catch (error: any) {
    throw new Error('Failed Sign in Organization');
  }
};
