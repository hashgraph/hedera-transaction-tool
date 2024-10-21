import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createClient } from 'redis';

@Injectable()
export class BlacklistService {
  private BLACKLISTED = 'blacklisted';

  constructor(private readonly configService: ConfigService) {}

  async blacklistToken(jwt: string) {
    await this.withClient(async client => {
      const expirationDays = this.configService.get<number>('JWT_EXPIRATION', { infer: true });
      const expirationSeconds = expirationDays * 24 * 60 * 60;

      await client.set(jwt, this.BLACKLISTED, {
        EX: expirationSeconds,
      });
    });
  }

  async isTokenBlacklisted(jwt: string) {
    return await this.withClient(async client => {
      const result = await client.get(jwt);
      return result === this.BLACKLISTED;
    });
  }

  async withClient<T>(
    callback: (client: ReturnType<typeof createClient>) => Promise<T>,
  ): Promise<T> {
    const redisURL = this.configService.get('REDIS_URL');
    const client = createClient(redisURL);

    const result = await callback(client);

    await client.quit();

    return result;
  }
}
