// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { IAccountInfoParsed } from '@shared/interfaces';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService.ts';

export class AccountByIdCache extends EntityCache<string, IAccountInfoParsed | null> {
  //
  // EntityCache
  //

  protected override async load(
    accountId: string,
    mirrorNodeLink: string,
  ): Promise<IAccountInfoParsed | null> {
    let result: Promise<IAccountInfoParsed | null>;
    try {
      result = getAccountInfo(accountId, mirrorNodeLink);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 404) {
        result = Promise.resolve(null);
      } else {
        throw error;
      }
    }
    return result;
  }
}
