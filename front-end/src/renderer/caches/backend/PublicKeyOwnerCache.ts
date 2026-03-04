import axios from 'axios';
import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getPublicKeyOwner } from '@renderer/services/organization';

export class PublicKeyOwnerCache extends EntityCache<string, string | null> {
  private static readonly injectKey = Symbol();

  //
  // Public
  //

  public constructor() {
    super(4000); // Short live for backend data
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
    let result: string | null;
    try {
      result = await getPublicKeyOwner(serverUrl, publicKey);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 404) {
        result = null;
      } else {
        throw error;
      }
    }
    return result;
  }
}
