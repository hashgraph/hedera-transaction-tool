import type { AxiosRequestConfig, AxiosResponse } from 'axios';

import axios, { AxiosError } from 'axios';

import { ErrorCodes, ErrorMessages } from '@main/shared/constants';
import { getAuthTokenFromSessionStorage } from '@renderer/utils';

export function throwIfNoResponse(response?: AxiosResponse): asserts response is AxiosResponse {
  if (!response) {
    throw new Error('Failed to connect to the server');
  }
}

export const commonRequestHandler = async <T>(
  callback: () => Promise<T>,
  defaultMessage: string = 'Failed to send request',
  messageOn401?: string,
) => {
  try {
    return await callback();
  } catch (error) {
    let message = defaultMessage;

    if (error instanceof AxiosError) {
      throwIfNoResponse(error.response);

      const errorMessage = error.response.data?.message;
      if (error.response.status === 401 && message.length > 0) {
        message = messageOn401?.trim() || errorMessage;
      }

      if (error.response.status === 400) {
        const code: keyof typeof ErrorMessages = error.response.data?.code || ErrorCodes.UNKWN;
        message = ErrorMessages[code] || ErrorMessages[ErrorCodes.UNKWN];
      }
    }
    throw new Error(message);
  }
};

const getConfigWithAuthHeader = (config: AxiosRequestConfig, url: string) => {
  return {
    ...config,
    headers: {
      ...config.headers,
      Authorization: `bearer ${getAuthTokenFromSessionStorage(url)}`,
    },
  };
};

export const axiosWithCredentials = {
  get: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.get<T, R>(url, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  post: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.post<T, R>(url, data, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  patch: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.patch<T, R>(url, data, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  delete: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D> | undefined,
  ) =>
    axios.delete<T, R>(url, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
};
