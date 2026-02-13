import axios, { AxiosError, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import type { IVersionCheckResponse } from '@shared/interfaces';
import { ErrorCodes, ErrorMessages } from '@shared/constants';

import { getAuthTokenFromSessionStorage } from '@renderer/utils';

import { FRONTEND_VERSION } from './version';
import {
  setOrgVersionBelowMinimum,
  setVersionDataForOrg,
  organizationCompatibilityResults,
} from '@renderer/stores/versionState';
import useUserStore from '@renderer/stores/storeUser';

import { checkCompatibilityAcrossOrganizations } from '@renderer/services/organization/versionCompatibility';
import { useToast } from 'vue-toast-notification';
import { warningToastOptions } from './toastOptions';

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

axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 426) {
      const errorUpdateUrl = error.response.data?.updateUrl || null;
      const errorLatestVersion = error.response.data?.latestSupportedVersion || null;
      const errorMinimumVersion = error.response.data?.minimumSupportedVersion || null;

      const requestUrl = error.config?.url || error.config?.baseURL || '';
      const serverUrl = extractServerUrlFromRequest(requestUrl);

      if (serverUrl) {
        const versionData: IVersionCheckResponse = {
          latestSupportedVersion: errorLatestVersion || '',
          minimumSupportedVersion: errorMinimumVersion || '',
          updateUrl: errorUpdateUrl,
        };
        setVersionDataForOrg(serverUrl, versionData);

        if (errorLatestVersion) {
          try {
            const compatibilityResult = await checkCompatibilityAcrossOrganizations(
              errorLatestVersion,
              serverUrl,
            );

            organizationCompatibilityResults.value[serverUrl] = compatibilityResult;

            if (compatibilityResult.hasConflict) {
              const conflictOrgNames = compatibilityResult.conflicts
                .map(c => c.organizationName)
                .join(', ');

              // Show toast notification for compatibility conflicts
              const toast = useToast();
              toast.warning(
                `Update may cause issues with ${conflictOrgNames}. Please review compatibility warnings.`,
                warningToastOptions,
              );

              console.warn(
                `[${new Date().toISOString()}] COMPATIBILITY_CHECK Version guard failure for ${serverUrl}`,
              );
              console.warn(
                `Conflicts found with ${compatibilityResult.conflicts.length} organization(s)`,
              );
            }
          } catch (compatError) {
            console.error('Compatibility check failed:', compatError);
            organizationCompatibilityResults.value[serverUrl] = null;
          }
        }

        setOrgVersionBelowMinimum(serverUrl, errorUpdateUrl);
      }
    }
    return Promise.reject(error);
  },
);

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

      if (error.response.status === 429) {
        message = 'Too many requests. Please try again later.';
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
