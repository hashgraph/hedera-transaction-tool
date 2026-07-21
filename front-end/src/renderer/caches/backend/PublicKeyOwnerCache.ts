import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import { getPublicKeyOwner } from '@renderer/services/organization';
import type { Organization } from '@prisma/client';

export class PublicKeyOwnerCache extends EntityCache<string, string | null, Organization> {
  //
  // EntityCache
  //

  protected override async load(
    publicKey: string,
    organization: Organization,
  ): Promise<string | null> {
    return await getPublicKeyOwner(organization, publicKey);
  }

  override makeRecordKey(key: string | number, organization: Organization): string {
    return key.toString() + '/' + organization.serverUrl;
  }
}
