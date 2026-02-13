import axios, { AxiosError } from 'axios';

const healthController = '/';

export const healthCheck = async (serverUrl: string): Promise<boolean> => {
  try {
    const { data } = await axios.get(`${serverUrl}${healthController}`, { timeout: 3000 });
    return data || false;
  } catch (error) {
    // Treat 426 (Upgrade Required) as reachable — allows adding organizations
    // that require a client update before full functionality is available
    if (error instanceof AxiosError && error.response?.status === 426) {
      return true;
    }
    return false;
  }
};
