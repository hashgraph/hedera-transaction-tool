import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { CLIENT_IP_KEY } from './client-ip.types';

export const ClientIpFactory = (_data: unknown, context: ExecutionContext): string => {
  const req = context.switchToHttp().getRequest<Request>();
  return req[CLIENT_IP_KEY];
};

export const ClientIp = createParamDecorator(ClientIpFactory);
