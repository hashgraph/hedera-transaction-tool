import { DynamicModule, Logger, Module } from '@nestjs/common';
import { NatsJetStreamService } from './nats-jetstream.service';
import { NatsStreamInitializerService } from './nats-stream-initializer.service';
import { NatsPublisherService } from './nats.publisher';

@Module({})
export class NatsModule {
  private static readonly logger = new Logger(NatsModule.name);

  static forRoot(): DynamicModule {
    return {
      module: NatsModule,
      providers: [
        {
          provide: NatsJetStreamService,
          useFactory: async () => {
            const service = new NatsJetStreamService();
            await service.onModuleInit();

            if (!service.isConnected()) {
              NatsModule.logger.warn(
                'NATS is not connected after initialization. ' +
                  'Service will operate in degraded mode until NATS becomes available.',
              );
            }

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