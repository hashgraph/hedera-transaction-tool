import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

@Injectable()
export class BlacklistService {
  private BLACKLISTED = 'blacklisted';

  client: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisURL = this.configService.get('REDIS_URL');
    this.client = new Redis(redisURL);
  }

  async blacklistToken(jwt: string) {
    const expirationDays = this.configService.get<number>('JWT_EXPIRATION');
    const expirationSeconds = Number(expirationDays) * 24 * 60 * 60;

    await this.client.set(jwt, this.BLACKLISTED, 'EX', expirationSeconds);
  }

  async isTokenBlacklisted(jwt: string) {
    const data = await this.client.get(jwt);
    return data === this.BLACKLISTED;
  }
}
