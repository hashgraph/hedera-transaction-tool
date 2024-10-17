import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { ErrorCodes } from '@app/common';
import { Network } from '@entities';

export const NetworkParam = createParamDecorator(
  (validProperties, ctx: ExecutionContext): Network => {
    const req: Request = ctx.switchToHttp().getRequest();

    if (!req.query.network) throw new BadRequestException(ErrorCodes.INP);

    const network: string = req.query.network?.toString();

    if (Object.values(Network).includes(network as Network)) return network as Network;
    else throw new BadRequestException(ErrorCodes.INP);
  },
);
