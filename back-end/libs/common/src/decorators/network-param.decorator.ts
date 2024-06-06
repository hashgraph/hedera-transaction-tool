import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { Network } from '../database/entities';

export const NetworkParam = createParamDecorator(
  (validProperties, ctx: ExecutionContext): Network => {
    const req: Request = ctx.switchToHttp().getRequest();

    if (!req.query.network) throw new BadRequestException('Network query is required');

    const network: string = req.query.network?.toString();

    if (Object.values(Network).includes(network as Network)) return network as Network;
    else throw new BadRequestException('Invalid network parameter');
  },
);
