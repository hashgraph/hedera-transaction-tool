import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import type { IVersionCheckResponse } from '@shared/interfaces';
import { ErrorCodes, ErrorMessages } from '@shared/constants';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.axios');

import { FRONTEND_VERSION } from './version';
import {
  setVersionDataForOrg,
} from '@renderer/stores/versionState';
import useUserStore from '@renderer/stores/storeUser';
import { updateOrganizationCredentials } from '@renderer/services/organizationCredentials';
import { isUserLoggedIn } from '@renderer/utils';

// Per-org guard so cascading 401s on the same org only trigger one reauth attempt
const orgReauthInProgress = new Set<string>();

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

export async function handleUnauthorizedResponse(error: {
  config?: { url?: string; baseURL?: string };
}): Promise<void> {
  try {
    const requestUrl = error.config?.url || error.config?.baseURL || '';
    const userStore = useUserStore();
    const org = userStore.organizations.find(o => requestUrl.startsWith(o.serverUrl));
    if (!org) return;

    // Only handle 401s where we actually sent a token — if there's no in-memory
    // token the request was unauthenticated and the 401 is expected.
    if (!userStore.getJwtToken(org.id)) return;

    // Deduplicate: ignore cascading 401s while reauth is already in progress
    if (orgReauthInProgress.has(org.serverUrl)) return;
    orgReauthInProgress.add(org.serverUrl);

    try {
      userStore.clearJwtToken(org.id);

      const userId = isUserLoggedIn(userStore.personal) ? userStore.personal.id : null;
      if (userId) {
        await updateOrganizationCredentials(org.id, userId, undefined, undefined, null);
      }

      userStore.signalReauth();
    } finally {
      orgReauthInProgress.delete(org.serverUrl);
    }
  } catch (err) {
    logger.error('Failed handling 401 response', err);
  }
}

axios.interceptors.response.use(
  response => response,
  async error => {
    handleAxiosResponseError(error);
    if (error.response?.status === 401) {
      await handleUnauthorizedResponse(error);
    }
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

export const axiosWithCredentials = {
  get: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D>,
  ) =>
    axios.get<T, R>(url, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  post: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D>,
  ) =>
    axios.post<T, R>(url, data, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  patch: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig<D>,
  ) =>
    axios.patch<T, R>(url, data, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
  delete: <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: AxiosRequestConfig<D>,
  ) =>
    axios.delete<T, R>(url, {
      ...getConfigWithAuthHeader(config || {}, url),
    }),
};
