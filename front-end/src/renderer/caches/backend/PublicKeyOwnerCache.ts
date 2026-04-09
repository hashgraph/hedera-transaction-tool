import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getPublicKeyOwner } from '@renderer/services/organization';

export class PublicKeyOwnerCache extends EntityCache<string, string | null> {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public constructor() {
    super(3 * 60_000); // Enables to preserve key owners across Sign & Next actions
  }

  public static provide(): void {
    provide(PublicKeyOwnerCache.injectKey, new PublicKeyOwnerCache());
  }

  public static inject(): PublicKeyOwnerCache {
    const defaultFactory = () => new PublicKeyOwnerCache();
    return inject<PublicKeyOwnerCache>(PublicKeyOwnerCache.injectKey, defaultFactory, true);
  }

  //
  // EntityCache
  //

  protected override async load(publicKey: string, serverUrl: string): Promise<string | null> {
    return await getPublicKeyOwner(serverUrl, publicKey);
  }
}
