import type { IApiKeyStatus } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

/* API key service for organization */
const controller = 'api-keys';

export type { ApiKeyRevokedReason } from '@shared/interfaces';
export type ApiKeyStatus = IApiKeyStatus;

export interface ApiKeyCreated {
  key: string;
}

/* Get the status of the caller's own API key (never includes the secret) */
export const getApiKeyStatus = (organizationServerUrl: string): Promise<ApiKeyStatus> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.get<ApiKeyStatus>(
      `${organizationServerUrl}/${controller}/status`,
    );
    return response.data;
  }, 'Failed to get API key status');

/* Create a new API key for the caller. The full key is only ever returned once. */
export const createApiKey = (organizationServerUrl: string): Promise<ApiKeyCreated> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post<ApiKeyCreated>(
      `${organizationServerUrl}/${controller}`,
    );
    return response.data;
  }, 'Failed to create API key');

/* Regenerate the caller's API key. Invalidates the previous key immediately. */
export const regenerateApiKey = (organizationServerUrl: string): Promise<ApiKeyCreated> =>
  commonRequestHandler(async () => {
    const response = await axiosWithCredentials.post<ApiKeyCreated>(
      `${organizationServerUrl}/${controller}/regenerate`,
    );
    return response.data;
  }, 'Failed to regenerate API key');

/* Revoke the caller's API key */
export const revokeApiKey = (organizationServerUrl: string): Promise<void> =>
  commonRequestHandler(async () => {
    await axiosWithCredentials.post(`${organizationServerUrl}/${controller}/revoke`);
  }, 'Failed to revoke API key');
