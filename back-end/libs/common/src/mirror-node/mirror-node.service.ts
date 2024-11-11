import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import { AccountInfo, MirrorNodeREST, NetworkNode, NetworkNodesResponse } from '@app/common';

@Injectable()
export class MirrorNodeService {
  private endointPrefix = '/api/v1';
  private cacheExpirationMs = 5 * 60 * 1_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  /* Get the account information for accountId */
  async getAccountInfo(accountId: string, mirrorNetwork: string): Promise<AccountInfo> {
    const env = this.configService.get<string>('NODE_ENV');

    const cachedData = await this.cacheService.get<AccountInfo>(
      this.getAccountCacheKey(accountId, mirrorNetwork),
    );

    if (cachedData && env !== 'test') return cachedData;

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeRESTURL(mirrorNetwork)}/accounts/${accountId}`,
    );

    await this.cacheService.set(
      this.getAccountCacheKey(accountId, mirrorNetwork),
      data,
      this.cacheExpirationMs,
    );

    return data;
  }

  /* Update the account information for accountId in the cache */
  async updateAccountInfo(accountId: string, mirrorNetwork: string): Promise<AccountInfo> {
    const restURL = this.getMirrorNodeRESTURL(mirrorNetwork);

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${restURL}/accounts/${accountId}`,
    );

    await this.cacheService.set(
      this.getAccountCacheKey(accountId, restURL),
      data,
      this.cacheExpirationMs,
    );

    return data;
  }

  private getAccountCacheKey(accountId: string, mirrorNetwork: string) {
    return `${mirrorNetwork}-${accountId}`;
  }

  private getNodeCacheKey(nodeId: string, mirrorNetwork: string) {
    return `${mirrorNetwork}-nodeId-${nodeId}`;
  }

  private getMirrorNodeRESTURL(mirrorNetwork: string) {
    return `${MirrorNodeREST.fromBaseURL(mirrorNetwork)}${this.endointPrefix}`;
  }

  /* Get the node information for nodeId */
  async getNodeInfo(nodeId: number, mirrorNetwork: string) {
    const env = this.configService.get<string>('NODE_ENV');

    const cachedData = await this.cacheService.get<NetworkNode>(
      this.getNodeCacheKey(nodeId.toString(), mirrorNetwork),
    );

    if (cachedData && env !== 'test') return cachedData;

    const { data } = await this.httpService.axiosRef.get<NetworkNodesResponse>(
      `${this.getMirrorNodeRESTURL(mirrorNetwork)}/network/nodes?node.id=eq:${nodeId}`,
    );

    if (data.nodes && data.nodes.length > 0) {
      await this.cacheService.set(
        this.getNodeCacheKey(nodeId.toString(), mirrorNetwork),
        data.nodes[0],
        this.cacheExpirationMs,
      );
      return data.nodes[0];
    }
    return null;
  }
}
