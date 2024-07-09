import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@entities';

export const GetUserFactory = (data: unknown, context: ExecutionContext): User => {
  const request = context.switchToHttp().getRequest();
  return request.user;
};

export const GetUser = createParamDecorator(GetUserFactory);
