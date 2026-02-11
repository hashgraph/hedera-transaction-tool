import { DynamicModule, Module } from '@nestjs/common';
import { NatsJetStreamService } from './nats-jetstream.service';
import { NatsStreamInitializerService } from './nats-stream-initializer.service';
import { NatsPublisherService } from './nats.publisher';

@Module({})
export class NatsModule {
  static forRoot(): DynamicModule {
    return {
      module: NatsModule,
      providers: [
        {
          provide: NatsJetStreamService,
          useFactory: async () => {
            const service = new NatsJetStreamService();
            await service.onModuleInit();
            return service;
          },
        },
        NatsStreamInitializerService,
        NatsPublisherService,
      ],
      exports: [NatsPublisherService, NatsJetStreamService],
      global: true,
    };
  }
}