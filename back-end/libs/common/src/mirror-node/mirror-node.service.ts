import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

import { AccountInfo, MirrorNodeBaseURL } from '@app/common';

@Injectable()
export class MirrorNodeService {
  private cacheExpirationMs = 5 * 60 * 1_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  /* Get the account information for accountId */
  async getAccountInfo(accountId: string, mirrorNetworkRest: string): Promise<AccountInfo> {
    const env = this.configService.get<string>('NODE_ENV');

    const cachedData = await this.cacheService.get<AccountInfo>(
      this.getCacheKey(accountId, mirrorNetworkRest),
    );

    if (cachedData && env !== 'test') return cachedData;

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeBaseURL(mirrorNetworkRest)}/accounts/${accountId}`,
    );

    await this.cacheService.set(
      this.getCacheKey(accountId, mirrorNetworkRest),
      data,
      this.cacheExpirationMs,
    );

    return data;
  }

  async updateAccountInfo(accountId: string, mirrorNetworkRest: string): Promise<AccountInfo> {
    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeBaseURL(mirrorNetworkRest)}/accounts/${accountId}`,
    );

    await this.cacheService.set(
      this.getCacheKey(accountId, mirrorNetworkRest),
      data,
      this.cacheExpirationMs,
    );

    return data;
  }

  private getCacheKey(accountId: string, mirrorNetworkRest: string) {
    return `${mirrorNetworkRest}-${accountId}`;
  }

  private getMirrorNodeBaseURL(mirrorNetworkRest: string) {
    return MirrorNodeBaseURL.fromURL(mirrorNetworkRest);
  }
}
