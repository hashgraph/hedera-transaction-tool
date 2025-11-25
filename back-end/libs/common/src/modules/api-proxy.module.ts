import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { API_SERVICE } from '@app/common';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: API_SERVICE,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.NATS,
          options: {
            servers: [configService.getOrThrow<string>('NATS_URL')],
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class ApiProxyModule {}
