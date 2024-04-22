import axios, { AxiosError } from 'axios';
import { throwIfNoResponse } from '.';

const controller = 'transactions';

/* Login the user */
export const submitTransaction = async (
  serverUrl: string,
  name: string,
  description: string,
  body: string,
  signature: string,
  creatorKeyId: number,
): Promise<{ id: number; body: string }> => {
  try {
    const { data } = await axios.post(
      `${serverUrl}/${controller}`,
      {
        name,
        description,
        body,
        signature,
        creatorKeyId,
      },
      {
        withCredentials: true,
      },
    );

    console.log(data);

    return { id: data.id, body: data.body };
  } catch (error: any) {
    let message = 'Failed submit transaction';

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = errorMessage;
      }
    }
    throw new Error(message);
  }
};
