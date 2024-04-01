import axios from 'axios';

/* Authentification service for organization */

export const login = async (serverUrl: string, email: string, password: string) => {
  try {
    const res = await axios.post(
      `${serverUrl}/auth/login`,
      {
        email,
        password,
      },
      {
        withCredentials: true,
      },
    );

    return { id: res.data.id, cookie: res.headers['set-cookie'] };
  } catch (error: any) {
    throw new Error('Failed Sign in Organization');
  }
};
