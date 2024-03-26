import axios from 'axios';

const pingPath = '/users';

export const ping = async (serverUrl: string): Promise<boolean> => {
  try {
    const response = await axios.get(`${serverUrl}${pingPath}`);
    console.log(response);
    return true;
  } catch (error: any) {
    console.log(error);
    return false;
  }
};
