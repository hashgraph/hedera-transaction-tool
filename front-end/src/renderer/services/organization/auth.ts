import axios, { AxiosError } from 'axios';
import { throwIfNoResponse } from '.';

/* Authentification service for organization */

const authController = 'auth';

export const login = async (
  serverUrl: string,
  email: string,
  password: string,
): Promise<string> => {
  try {
    const response = await axios.post(
      `${serverUrl}/${authController}/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      },
    );

    return response.data?.accessToken || '';
  } catch (error: any) {
    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      if ([400, 401].includes(error.response?.status || 0)) {
        throw new Error('Invalid email or password');
      }
    }

    throw new Error('Failed Sign in Organization');
  }
};
