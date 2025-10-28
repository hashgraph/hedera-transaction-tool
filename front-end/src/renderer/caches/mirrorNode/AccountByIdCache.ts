// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { IAccountInfoParsed } from '@shared/interfaces';
import { getAccountInfo } from '@renderer/services/mirrorNodeDataService.ts';

export class AccountByIdCache extends EntityCache<string, IAccountInfoParsed | null> {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public static provide(): void {
    provide(AccountByIdCache.injectKey, new AccountByIdCache());
  }

  public static inject(): AccountByIdCache {
    const defaultFactory = () => new AccountByIdCache();
    return inject<AccountByIdCache>(AccountByIdCache.injectKey, defaultFactory, true);
  }

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
