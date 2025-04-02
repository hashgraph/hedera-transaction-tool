import axios from 'axios';

const healthController = '/';

export const healthCheck = async (serverUrl: string): Promise<boolean> => {
  try {
    const { data } = await axios.get(`${serverUrl}${healthController}`, { timeout: 3000 });
    return data || false;
  } catch {
    return false;
  }
};
