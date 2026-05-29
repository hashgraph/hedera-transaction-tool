import axios, { type AxiosResponse } from 'axios';
import { EntityCache } from '@renderer/caches/base/EntityCache.ts';
import type {
  IRegisteredNodeInfoParsed,
  RegisteredNode,
  RegisteredNodesResponse,
} from '@shared/interfaces';
import { parseRegisteredNode } from '@renderer/services/mirrorNodeDataService';

export class RegisteredNodeByIdCache extends EntityCache<number, IRegisteredNodeInfoParsed | null> {
  //
  // EntityCache
  //

  protected override async load(
    nodeId: number,
    mirrorNodeURL: string,
  ): Promise<IRegisteredNodeInfoParsed | null> {
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

    return result !== null ? parseRegisteredNode(result) : null;
  }
}
