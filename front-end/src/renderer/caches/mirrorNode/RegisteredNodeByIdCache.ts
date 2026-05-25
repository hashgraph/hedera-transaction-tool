import axios, { type AxiosResponse } from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { IRegisteredNode, IRegisteredNodesResponse } from '@shared/interfaces';

export class RegisteredNodeByIdCache extends EntityCache<number, IRegisteredNode | null> {
  //
  // EntityCache
  //

  protected override async load(
    nodeId: number,
    mirrorNodeURL: string,
  ): Promise<IRegisteredNode | null> {
    let result: IRegisteredNode | null = null;

    let nextURL: string | null =
      mirrorNodeURL + '/api/v1/network/registered-nodes?registerednode.id=' + nodeId;
    while (result === null && nextURL !== null) {
      const response: AxiosResponse<IRegisteredNodesResponse> =
        await axios.get<IRegisteredNodesResponse>(nextURL);
      const registeredNodes = response.data.registered_nodes ?? [];
      result = registeredNodes.length > 0 ? registeredNodes[0] : null;
      nextURL = response.data.links.next ?? null;
    }
    return result;
  }
}
