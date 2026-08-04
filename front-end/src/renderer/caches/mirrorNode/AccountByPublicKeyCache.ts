import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { AccountInfo } from '@shared/interfaces';
import { getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService.ts';

export class AccountByPublicKeyCache extends EntityCache<string, AccountInfo[]> {
  //
  // Public
  //

  public async batchLookup(
    publicKeys: string[],
    mirrorNodeUrl: string,
    forceLoad = false,
  ): Promise<{ [key: string]: AccountInfo[] }> {
    const entries = await Promise.all(
      publicKeys.map(async key => [key, await this.lookup(key, mirrorNodeUrl, forceLoad)] as const),
    );
    return Object.fromEntries(entries);
  }

  //
  // EntityCache
  //

  protected override async load(publicKey: string, mirrorNodeLink: string): Promise<AccountInfo[]> {
    return getAccountsByPublicKey(mirrorNodeLink, publicKey);
  }
}
