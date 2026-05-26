import axios, { type AxiosResponse } from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type { RegisteredNode, RegisteredNodesResponse } from '@shared/interfaces';

export class RegisteredNodeByIdCache extends EntityCache<number, RegisteredNode | null> {
  //
  // EntityCache
  //

  protected override async load(
    nodeId: number,
    mirrorNodeURL: string,
  ): Promise<RegisteredNode | null> {
    let result: RegisteredNode | null = null;

    let nextURL: string | null =
      mirrorNodeURL + '/api/v1/network/registered-nodes?registerednode.id=' + nodeId;
    while (result === null && nextURL !== null) {
      const response: AxiosResponse<RegisteredNodesResponse> =
        await axios.get<RegisteredNodesResponse>(nextURL);
      const registeredNodes = response.data.registered_nodes ?? [];
      result = registeredNodes.length > 0 ? registeredNodes[0] : null;
      nextURL = response.data.links.next ?? null;
    }
    return result;
  }
}
