import type { IVersionCheckResponse } from '@shared/interfaces';
import { VERSION_CHECK_TIMEOUT_MS } from '@shared/constants';

import { axiosWithCredentials, commonRequestHandler } from '@renderer/utils';
import type { Organization } from '@prisma/client';

const controller = 'users';

export const checkVersion = async (
  organization: Organization,
  version: string,
): Promise<IVersionCheckResponse> =>
  commonRequestHandler(async () => {
    const { data } = await axiosWithCredentials.post(
      organization,
      `${controller}/version-check`,
      { version },
      { timeout: VERSION_CHECK_TIMEOUT_MS },
    );
    return data;
  }, 'Failed to check version');
