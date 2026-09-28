import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { CLIENT_IP_KEY } from './client-ip.types';
import { IpResolverService } from './ip-resolver.service';

/**
 * Runs early, before guards and controller code, and stashes the resolved client IP on
 * the request under CLIENT_IP_KEY. Everything downstream (rate limiters, @ClientIp())
 * reads that instead of touching headers/req.ip directly.
 */
@Injectable()
export class ClientIpMiddleware implements NestMiddleware {
  constructor(private readonly resolver: IpResolverService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    req[CLIENT_IP_KEY] = this.resolver.resolve(req);
    next();
  }
}
