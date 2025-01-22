import axios from 'axios';

const healtController = '/';

export const healthCheck = async (serverUrl: string): Promise<boolean> => {
  try {
    const { data } = await axios.get(`${serverUrl}${healtController}`);
    return data || false;
  } catch {
    return false;
  }
};
