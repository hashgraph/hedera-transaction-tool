import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import { Redis } from 'ioredis';

import { LEGACY_IOREDIS_OPTIONS } from '@app/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | undefined;

  connectToRedis(url: string) {
    const redisClient = new Redis(url, LEGACY_IOREDIS_OPTIONS);
    this.adapterConstructor = createAdapter(redisClient);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
