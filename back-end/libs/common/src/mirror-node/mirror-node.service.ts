import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import { AccountInfo, MirrorNodeREST } from '@app/common';

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
      this.getCacheKey(accountId, mirrorNetwork),
    );

    if (cachedData && env !== 'test') return cachedData;

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeRESTURL(mirrorNetwork)}/accounts/${accountId}`,
    );

    await this.cacheService.set(
      this.getCacheKey(accountId, mirrorNetwork),
      data,
      this.cacheExpirationMs,
    );

    return data;
  }

  async updateAccountInfo(accountId: string, mirrorNetwork: string): Promise<AccountInfo> {
    const restURL = this.getMirrorNodeRESTURL(mirrorNetwork);

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${restURL}/accounts/${accountId}`,
    );

    await this.cacheService.set(this.getCacheKey(accountId, restURL), data, this.cacheExpirationMs);

    return data;
  }

  private getCacheKey(accountId: string, mirrorNetwork: string) {
    return `${mirrorNetwork}-${accountId}`;
  }

  private getMirrorNodeRESTURL(mirrorNetwork: string) {
    return `${MirrorNodeREST.fromBaseURL(mirrorNetwork)}${this.endointPrefix}`;
  }
}
