import axios from 'axios';

import { version } from '../../../../package.json';

/* Authentication service for organization */

export const login = async (serverUrl: string, email: string, password: string) => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/auth/login`,
      { email, password },
      { headers: { 'x-frontend-version': version } },
    );

    return { id: data.user.id, accessToken: data.accessToken };
  } catch {
    throw new Error('Failed Sign in Organization');
  }
};
