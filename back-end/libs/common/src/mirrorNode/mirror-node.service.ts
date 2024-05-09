import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import { Cache } from 'cache-manager';

import { AccountInfo, MirrorNodeBaseURL } from '@app/common';

@Injectable()
export class MirrorNodeService {
  mirrorNodeBaseURL: string;

  /* Temporary manual cache */
  private cacheExpirationMs = 5 * 60 * 1_000;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {
    this.mirrorNodeBaseURL = MirrorNodeBaseURL.fromName(this.configService.get('HEDERA_NETWORK'));
  }

  /* Get the account inforamtion for accountId */
  async getAccountInfo(accountId: string): Promise<AccountInfo> {
    const cachedData = await this.cacheService.get<AccountInfo>(accountId);

    if (cachedData) return cachedData;

    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.mirrorNodeBaseURL}/accounts/${accountId}`,
    );

    await this.cacheService.set(accountId, data, this.cacheExpirationMs);

    return data;
  }
}
