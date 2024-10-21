import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Redis } from 'ioredis';

@Injectable()
export class BlacklistService {
  private BLACKLISTED = 'blacklisted';

  constructor(private readonly configService: ConfigService) {}

  async blacklistToken(jwt: string) {
    await this.withClient(async client => {
      const expirationDays = this.configService.get<number>('JWT_EXPIRATION');
      const expirationSeconds = Number(expirationDays) * 24 * 60 * 60;

      await client.set(jwt, this.BLACKLISTED, 'EX', expirationSeconds);
    });
  }

  async isTokenBlacklisted(jwt: string) {
    return await this.withClient(async client => {
      const data = await client.get(jwt);
      return data === this.BLACKLISTED;
    });
  }

  async withClient<T>(callback: (client: Redis) => Promise<T>): Promise<T> {
    const redisURL = this.configService.get('REDIS_URL');
    const client = new Redis(redisURL);

    const result = await callback(client);

    await client.quit();

    return result;
  }
}
