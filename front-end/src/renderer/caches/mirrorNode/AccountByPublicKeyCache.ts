import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { AccountInfo } from '@shared/interfaces';
import { getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService.ts';

export class AccountByPublicKeyCache extends EntityCache<string, AccountInfo[]> {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public static provide(): void {
    provide(AccountByPublicKeyCache.injectKey, new AccountByPublicKeyCache());
  }

  public static inject(): AccountByPublicKeyCache {
    const defaultFactory = () => new AccountByPublicKeyCache();
    return inject<AccountByPublicKeyCache>(AccountByPublicKeyCache.injectKey, defaultFactory, true);
  }

  public async batchLookup(
    publicKeys: string[],
    mirrorNodeUrl: string,
    forceLoad = false,
  ): Promise<{ [key: string]: AccountInfo[] }> {
    const result: { [key: string]: AccountInfo[] } = {};

    for (const key of publicKeys) {
      result[key] = await this.lookup(key, mirrorNodeUrl, forceLoad);
    }

    return Promise.resolve(result);
  }

  //
  // EntityCache
  //

  protected override async load(publicKey: string, mirrorNodeLink: string): Promise<AccountInfo[]> {
    return getAccountsByPublicKey(mirrorNodeLink, publicKey);
  }
}
