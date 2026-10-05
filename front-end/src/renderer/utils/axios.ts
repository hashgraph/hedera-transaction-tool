import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import type { IVersionCheckResponse } from '@shared/interfaces';
import { ErrorCodes, ErrorMessages } from '@shared/constants';
import { createLogger } from '@renderer/utils/logger';
import { FRONTEND_VERSION } from './version';
import { setVersionDataForOrg } from '@renderer/stores/versionState';
import useUserStore from '@renderer/stores/storeUser';
import { reconnectOrganization } from '@renderer/services/organization';

const logger = createLogger('renderer.axios');

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
export function handleAxiosResponseError(error: {
  response?: { status?: number; data?: Partial<IVersionCheckResponse> };
  config?: { url?: string; baseURL?: string };
}): void {
  if (error.response?.status !== 426) return;

  try {
    const requestUrl = error.config?.url || error.config?.baseURL || '';
    const serverUrl = extractServerUrlFromRequest(requestUrl);
    if (!serverUrl) return;
    if (!isValidVersionPayload(error.response.data)) {
      logger.warn('Received malformed 426 response; treating as unreachable', {
        serverUrl,
        responseData: error.response.data,
      });
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
    handleAxiosResponseError(error);
    return Promise.reject(error as Error);
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

      if (statusMessages?.[status]) {
        message = statusMessages[status]!;
      } else if (status === 401 && messageOn401) {
        message = messageOn401;
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

export class AxiosWithCredentials {
  async get<D>(
    url: string,
    config?: AxiosRequestConfig<Record<string, unknown>>,
    withReconnect = true,
  ): Promise<AxiosResponse<D>> {
    return this.runWithReconnect(
      () =>
        axios.get(url, {
          ...this.getConfigWithAuthHeader(config || {}, url),
        }),
      withReconnect,
    );
  }

  async post<D>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<Record<string, unknown>>,
    withReconnect = true,
  ) {
    return this.runWithReconnect(
      () =>
        axios.post(url, data, {
          ...this.getConfigWithAuthHeader(config || {}, url),
        }),
      withReconnect,
    );
  }

  async patch<D, R>(
    url: string,
    data?: D,
    config?: AxiosRequestConfig<Record<string, unknown>>,
  ): Promise<AxiosResponse<R>> {
    return this.runWithReconnect(() =>
      axios.patch(url, data, {
        ...this.getConfigWithAuthHeader(config || {}, url),
      }),
    );
  }

  async delete(url: string, config?: AxiosRequestConfig<Record<string, unknown>>): Promise<void> {
    await this.runWithReconnect(() =>
      axios.delete(url, {
        ...this.getConfigWithAuthHeader(config || {}, url),
      }),
    );
  }

  //
  // Private
  //
  private getConfigWithAuthHeader = (config: AxiosRequestConfig, url: string) => {
    const userStore = useUserStore();
    const org = userStore.organizations.find(o => url.startsWith(o.serverUrl));
    const authToken = org?.id ? userStore.getJwtToken(org.id) : null;
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `bearer ${authToken}`,
      },
    };
  };

  private async runWithReconnect<T, R, D>(
    cb: () => Promise<AxiosResponse<T, R, D>>,
    withReconnect = true,
  ): Promise<AxiosResponse<T, R, D>> {
    try {
      return await cb();
    } catch (error) {
      if (this.isExpiredTokenError(error) && withReconnect) {
        // JWT token has expired => we log in again and retry
        await this.tryReconnect(error);
        return await cb();
      } else {
        throw error;
      }
    }
  }

  private async tryReconnect(error: AxiosError) {
    const requestUrl = error.config?.url || error.config?.baseURL || '';
    const serverUrl = extractServerUrlFromRequest(requestUrl);
    if (serverUrl === null) throw error;
    const userStore = useUserStore();
    const org = userStore.organizations.find(o => serverUrl.startsWith(o.serverUrl));
    if (org === undefined) throw error;
    userStore.clearJwtToken(org.id);
    const { success } = await reconnectOrganization(serverUrl);
    if (!success) throw error;
  }

  private isExpiredTokenError(error: unknown): error is AxiosError {
    if (axios.isAxiosError(error) && error.status === 401) {
      return typeof error.config?.headers?.Authorization === 'string';
    } else {
      return false;
    }
  }
}

export const axiosWithCredentials = new AxiosWithCredentials();
