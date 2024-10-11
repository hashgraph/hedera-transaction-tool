import {
  applyDecorators,
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Request } from 'express';

import { attachKeys } from '@app/common/utils';
import { User } from '@entities';
import { InjectEntityManager } from '@nestjs/typeorm';

export const OnlyOwnerKey = <T>(keyIdProp: keyof T) => {
  return applyDecorators(UseInterceptors(createOnlyOwnerKeyInterceptor(keyIdProp)));
};

function createOnlyOwnerKeyInterceptor<T>(keyIdProp: keyof T) {
  @Injectable()
  class OnlyOwnerKeyInterceptor implements NestInterceptor {
    constructor(@InjectEntityManager() private readonly entityManager: EntityManager) {}

    async intercept(context: ExecutionContext, handler: CallHandler) {
      const request = context.switchToHttp().getRequest<Request & { user: User }>();
      const { user, body } = request;

      this.validateRequest(user, body);

      await attachKeys(user, this.entityManager);

      const keyIdValues = this.searchForKeyIdProp(body);

      const userKeyIds = new Set(user.keys.map(key => key.id));
      if (!keyIdValues.every(keyId => userKeyIds.has(keyId))) {
        throw new BadRequestException('Invalid key ID(s) provided.');
      }

      return handler.handle();
    }

    validateRequest(user: unknown, body: unknown): asserts user is User {
      if (!user) {
        throw new UnauthorizedException('User not authenticated.');
      }

      if (!body) {
        throw new BadRequestException('Request body is missing.');
      }
    }

    searchForKeyIdProp(obj): number[] {
      if (typeof obj !== 'object' || obj === null) return [];
      const keyIdValues: number[] = [];

      for (const key in obj) {
        if (key === keyIdProp) {
          if (obj[key] !== null) {
            keyIdValues.push(Number(obj[key]));
          }
        } else if (typeof obj[key] === 'object') {
          keyIdValues.push(...this.searchForKeyIdProp(obj[key]));
        }
      }

      return keyIdValues;
    }
  }

  return OnlyOwnerKeyInterceptor;
}
