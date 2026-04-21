import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getPublicKeyOwner } from '@renderer/services/organization';

export class PublicKeyOwnerCache extends EntityCache<string, string | null> {
  //
  // EntityCache
  //

  protected override async load(publicKey: string, serverUrl: string): Promise<string | null> {
    return await getPublicKeyOwner(serverUrl, publicKey);
  }
}
