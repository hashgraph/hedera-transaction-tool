import { Global, Module } from '@nestjs/common';

import { ClientIpMiddleware } from './client-ip.middleware';
import { IpResolverService } from './ip-resolver.service';

@Global()
@Module({
  providers: [IpResolverService, ClientIpMiddleware],
  exports: [IpResolverService, ClientIpMiddleware],
})
export class IpResolutionModule {}
