import axios from 'axios';
import { inject, provide } from 'vue';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { INodeInfoParsed } from '@shared/interfaces';
import { getNodeInfo } from '@renderer/services/mirrorNodeDataService.ts';

export class NodeByIdCache extends EntityCache<number, INodeInfoParsed | null> {
  private static readonly injectKey = Symbol();
  private static readonly LENGTHY = 2 * 3600_000;

  //
  // Public
  //

  public constructor() {
    super(NodeByIdCache.LENGTHY, NodeByIdCache.LENGTHY); // node info change infrequently so we keep them long time
  }

  public static provide(): void {
    provide(NodeByIdCache.injectKey, new NodeByIdCache());
  }

  public static inject(): NodeByIdCache {
    const defaultFactory = () => new NodeByIdCache();
    return inject<NodeByIdCache>(NodeByIdCache.injectKey, defaultFactory, true);
  }

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
}
