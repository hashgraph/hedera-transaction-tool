import { Redis } from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { RedisClientModule } from './redis-client.module';

describe('RedisClientModule', () => {
  it('quits the shared redis client on module destroy', () => {
    const client = mockDeep<Redis>();
    const redisClientModule = new RedisClientModule(client);

    redisClientModule.onModuleDestroy();

    expect(client.quit).toHaveBeenCalled();
  });
});
