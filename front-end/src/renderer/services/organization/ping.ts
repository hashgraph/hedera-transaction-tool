import axios from 'axios';

const pingController = '/ping';

export const ping = async (serverUrl: string): Promise<boolean> => {
  try {
    const response = await axios.get(`${serverUrl}${pingController}`);
    // console.log(response);
    if (response.data?.status == 'ok') {
      return true;
    }
    return false;
  } catch (error: any) {
    console.log(error);
    return false;
  }
};
