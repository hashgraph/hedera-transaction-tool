import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { Cache } from 'cache-manager';

import { Network } from '@entities';

import { AccountInfo, MirrorNodeBaseURL } from '@app/common';

@Injectable()
export class MirrorNodeService {
  private cacheExpirationMs = 5 * 60 * 1_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  /* Get the account inforamtion for accountId */
  async getAccountInfo(accountId: string, network: Network): Promise<AccountInfo> {
    const env = this.configService.get<string>('NODE_ENV');

    const cachedData = await this.cacheService.get<AccountInfo>(
      this.getCacheKey(accountId, network),
    );

    if (cachedData && env !== 'test') return cachedData;

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeBaseURL(network)}/accounts/${accountId}`,
    );

    await this.cacheService.set(this.getCacheKey(accountId, network), data, this.cacheExpirationMs);

    return data;
  }

  async updateAccountInfo(accountId: string, network: Network): Promise<AccountInfo> {
    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.getMirrorNodeBaseURL(network)}/accounts/${accountId}`,
    );

    await this.cacheService.set(this.getCacheKey(accountId, network), data, this.cacheExpirationMs);

    return data;
  }

  private getCacheKey(accountId: string, network: Network) {
    return `${network}-${accountId}`;
  }

  private getMirrorNodeBaseURL(network: Network) {
    return MirrorNodeBaseURL.fromName(network);
  }
}
