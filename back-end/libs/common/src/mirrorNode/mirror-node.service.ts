import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

import { AxiosResponse } from 'axios';

import { AccountInfo, MirrorNodeBaseURL } from '@app/common';

@Injectable()
export class MirrorNodeService {
  mirrorNodeBaseURL: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.mirrorNodeBaseURL = MirrorNodeBaseURL.fromName(this.configService.get('HEDERA_NETWORK'));
  }

  async getAccountInfo(accountId: string): Promise<AxiosResponse<AccountInfo>> {
    return this.httpService.axiosRef.get(`${this.mirrorNodeBaseURL}/accounts/${accountId}`);
  }
}
