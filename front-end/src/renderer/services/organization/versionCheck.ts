import type { IVersionCheckResponse } from '@shared/interfaces';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';

const controller = 'users';

export const checkVersion = async (
  serverUrl: string,
  version: string,
): Promise<IVersionCheckResponse> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(`${serverUrl}/${controller}/version-check`, {
      version,
    });
    return data;
  }, 'Failed to check version');
