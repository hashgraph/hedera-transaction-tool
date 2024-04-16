import { MirrorNodeBaseURL } from '@app/common';

import { Key } from '@hashgraph/sdk';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class MirrorNodeService {
  mirrorNodeBaseURL: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.mirrorNodeBaseURL = MirrorNodeBaseURL.fromName(this.configService.get('HEDERA_NETWORK'));
  }

  async getKey(accountId: string): Promise<Key> {
    throw new Error('Not implemented');
  }
}
