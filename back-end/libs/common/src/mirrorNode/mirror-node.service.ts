import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { AccountInfo, MirrorNodeBaseURL } from '@app/common';

@Injectable()
export class MirrorNodeService {
  mirrorNodeBaseURL: string;

  /* Temporary manual cache */
  private cacheExpirationMs = 5 * 1_000;
  private accountInfoCache: {
    [accountId: string]: {
      lastUpdated: number;
      accountInfo: AccountInfo;
    };
  } = {};

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.mirrorNodeBaseURL = MirrorNodeBaseURL.fromName(this.configService.get('HEDERA_NETWORK'));
  }

  /* Get the account inforamtion for accountId */
  async getAccountInfo(accountId: string): Promise<AccountInfo> {
    if (
      this.accountInfoCache[accountId] &&
      this.accountInfoCache[accountId].lastUpdated + this.cacheExpirationMs > new Date().getTime()
    ) {
      return this.accountInfoCache[accountId].accountInfo;
    }
    const { data } = await this.httpService.axiosRef.get<AccountInfo>(
      `${this.mirrorNodeBaseURL}/accounts/${accountId}`,
    );

    this.accountInfoCache[accountId] = {
      lastUpdated: new Date().getTime(),
      accountInfo: data,
    };

    return data;
  }
}
