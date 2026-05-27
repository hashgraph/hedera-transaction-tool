import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import type { IVersionCheckResponse } from '@shared/interfaces';
import { ErrorCodes, ErrorMessages } from '@shared/constants';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.axios');

import { getAuthTokenFromSessionStorage } from '@renderer/utils';

import { FRONTEND_VERSION } from './version';
import {
  setVersionDataForOrg,
} from '@renderer/stores/versionState';
import useUserStore from '@renderer/stores/storeUser';

const isValidVersionPayload = (
  data?: Partial<IVersionCheckResponse>,
): data is IVersionCheckResponse => {
  return (
    typeof data?.latestSupportedVersion === 'string' &&
    typeof data?.minimumSupportedVersion === 'string' &&
    (typeof data?.updateUrl === 'string' || data?.updateUrl === null)
  );
};

function extractServerUrlFromRequest(url: string): string | null {
  if (!url) return null;

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}`;
    }

    const userStore = useUserStore();
    if (userStore && userStore.organizations && userStore.organizations.length > 0) {
      for (const org of userStore.organizations) {
        if (url.includes(org.serverUrl) || org.serverUrl.includes(url.split('/')[0])) {
          return org.serverUrl;
        }
      }
      return userStore.organizations[0]?.serverUrl || null;
    }

    return null;
  } catch {
    return null;
  }
}

// Global interceptor to add frontend version header to ALL axios requests
axios.interceptors.request.use(config => {
  config.headers['x-frontend-version'] = FRONTEND_VERSION;
  return config;
});

/**
 * Handles the version-related side effects of an axios error response.
 * Currently only HTTP 426 (Upgrade Required) is meaningful — the backend
 * rejected the client as below its minimum supported version and includes
 * version metadata in the body. Exported for direct testing.
 */
export async function handleAxiosResponseError(error: {
  response?: { status?: number; data?: Partial<IVersionCheckResponse> };
  config?: { url?: string; baseURL?: string };
}): Promise<void> {
  if (error.response?.status !== 426) return;

  try {
    const requestUrl = error.config?.url || error.config?.baseURL || '';
    const serverUrl = extractServerUrlFromRequest(requestUrl);
    if (!serverUrl) return;
    if (!isValidVersionPayload(error.response.data)) {
      logger.warn('Ignoring 426 response without valid version payload', { serverUrl });
      return;
    }
    setVersionDataForOrg(serverUrl, error.response.data);
  } catch (err) {
    logger.error('Failed handling version response error', err);
  }

}

axios.interceptors.response.use(
  response => response,
  async error => {
    await handleAxiosResponseError(error);
    return Promise.reject(error);
  },
);

export function throwIfNoResponse(response?: AxiosResponse): asserts response is AxiosResponse {
  if (!response) {
    throw new Error('Failed to connect to the server');
  }
}

export class RequestError extends Error {
  readonly code?: ErrorCodes;
  readonly status?: number;

  constructor(message: string, code?: ErrorCodes, status?: number) {
    super(message);
    this.name = 'RequestError';
    this.code = code;
    this.status = status;
  }
}

export const commonRequestHandler = async <T>(
  callback: () => Promise<T>,
  defaultMessage: string = 'Failed to send request',
  messageOn401?: string,
  statusMessages?: Partial<Record<number, string>>,
) => {
  try {
    return await callback();
  } catch (error) {
    let message = defaultMessage;
    let code: ErrorCodes | undefined;
    let status: number | undefined;

    if (error instanceof AxiosError) {
      throwIfNoResponse(error.response);

      status = error.response.status;
      const errorMessage = error.response.data?.message;

      if (statusMessages?.[status]) {
        message = statusMessages[status]!;
      } else if (status === 401 && messageOn401) {
        message = messageOn401.trim() || errorMessage;
      } else if (status === 400) {
        code = error.response.data?.code || ErrorCodes.UNKWN;
        message = ErrorMessages[code!] || ErrorMessages[ErrorCodes.UNKWN];
        logger.error(`Bad request (code=${code}): ${message}`);
      } else if (status === 429) {
        message = 'Too many requests. Please try again later.';
      }
    }
    throw new RequestError(message, code, status);
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
