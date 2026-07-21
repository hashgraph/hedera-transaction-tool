import axios from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { INodeInfoParsed } from '@shared/interfaces';
import { getNodeInfo } from '@renderer/services/mirrorNodeDataService.ts';

export class NodeByIdCache extends EntityCache<number, INodeInfoParsed | null, string> {
  //
  // EntityCache
  //

  protected override async load(
    nodeId: number,
    mirrorNodeLink: string,
  ): Promise<INodeInfoParsed | null> {
    let result: Promise<INodeInfoParsed | null>;
    try {
      result = getNodeInfo(nodeId, mirrorNodeLink);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status == 404) {
        result = Promise.resolve(null);
      } else {
        throw error;
      }
    }
    return result;
  }

  override makeRecordKey(key: string | number, mirrorNodeUrl: string): string {
    return key.toString() + '/' + mirrorNodeUrl;
  }
}
