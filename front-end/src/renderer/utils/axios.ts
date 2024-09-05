import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import axios, { AxiosError } from 'axios';

export function throwIfNoResponse(error: AxiosError) {
  if (!error.response) {
    throw new Error('Failed to connect to the server');
  }
}

export const commonRequestHandler = async <T>(
  callback: () => Promise<T>,
  defaultMessage: string = 'Failed to send request',
  messageOn4XX?: string,
) => {
  try {
    return await callback();
  } catch (error: any) {
    let message = defaultMessage;

    if (error instanceof AxiosError) {
      throwIfNoResponse(error);

      const errorMessage = error.response?.data?.message;
      if ([400, 401].includes(error.response?.status || 0) && message.length > 0) {
        message = messageOn4XX?.trim() || errorMessage;
      }
    }
    throw new Error(message);
  }
};

export const axiosWithCredentials = {
  get: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.get<T, R>(url, {
      ...config,
      withCredentials: true,
    }),
  post: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D> | undefined,
  ) => axios.post<T, R>(url, data, { ...config, withCredentials: true }),
  patch: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D> | undefined,
  ) => axios.patch<T, R>(url, data, { ...config, withCredentials: true }),
  delete: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.delete<T, R>(url, {
      ...config,
      withCredentials: true,
    }),
};
