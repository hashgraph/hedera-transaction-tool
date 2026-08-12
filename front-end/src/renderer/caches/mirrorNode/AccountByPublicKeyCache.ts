import pLimit from 'p-limit';

import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { AccountInfo } from '@shared/interfaces';
import { getAccountsByPublicKey } from '@renderer/services/mirrorNodeDataService.ts';

// Mirror node public endpoint is rate-limited to ~50 req/s per IP.
// Cap concurrent lookups to stay well under that limit.
const MIRROR_NODE_CONCURRENCY = 5;

export class AccountByPublicKeyCache extends EntityCache<string, AccountInfo[]> {
  //
  // Public
  //

  public async batchLookup(
    publicKeys: string[],
    mirrorNodeUrl: string,
    forceLoad = false,
  ): Promise<{ [key: string]: AccountInfo[] }> {
    const limit = pLimit(MIRROR_NODE_CONCURRENCY);
    const entries = await Promise.all(
      publicKeys.map(key =>
        limit(() =>
          this.lookup(key, mirrorNodeUrl, forceLoad).then(result => [key, result] as const),
        ),
      ),
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
