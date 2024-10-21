import axios from 'axios';

/* Authentification service for organization */

export const login = async (serverUrl: string, email: string, password: string) => {
  try {
    const { data } = await axios.post(`${serverUrl}/auth/login`, {
      email,
      password,
    });

    return { id: data.user.id, accessToken: data.accessToken };
  } catch (error: any) {
    throw new Error('Failed Sign in Organization');
  }
};
