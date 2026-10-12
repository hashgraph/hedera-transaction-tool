import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CLIENT_IP_KEY } from '@app/common';

import { ApiKeysService } from '../api-keys/api-keys.service';
import { ALLOW_API_KEY } from '../decorators';

import { JwtAuthGuard } from './jwt-auth.guard';

// Authenticates requests that default to standard JWT auth, but may instead
// accept a GET-only read-only API key (X-Api-Key header) on routes or
// controllers marked with @AllowApiKey(). The two credentials are NOT both
// honored on a single request: if an X-Api-Key header is present, it is the
// ONLY credential considered - the request is authenticated (or rejected)
// purely on the key, and any Authorization/JWT header on the same request is
// ignored outright. Only when no X-Api-Key header is present does this fall
// back to JwtAuthGuard's normal passport ('jwt') flow, which also picks up
// IGNORE_CONTROLLER_GUARD handling for free. Routes without @AllowApiKey()
// reject a presented key outright rather than silently falling back to the
// JWT path - fails closed. Likewise, an empty X-Api-Key header or a repeated
// one (sent as an array) is rejected outright rather than being treated as
// absent or silently resolved to its first value.
//
// This guard does NOT check the blacklist or the user's verified status -
// stack JwtBlackListAuthGuard and VerifiedUserGuard alongside it in each
// controller instead, so both apply uniformly to the JWT and API-key paths
// alike rather than being re-inlined here and silently skipped for one of
// them.
@Injectable()
export class JwtOrApiKeyGuard extends JwtAuthGuard {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    reflector: Reflector,
  ) {
    super(reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];

    if (apiKeyHeader !== undefined) {
      if (Array.isArray(apiKeyHeader)) throw new UnauthorizedException();

      const allowApiKey = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowApiKey) throw new UnauthorizedException();

      return this.authenticateApiKey(request, apiKeyHeader);
    }

    return (await super.canActivate(context)) as boolean;
  }

  private async authenticateApiKey(request: any, apiKeyHeader: string): Promise<boolean> {
    if (request.method !== 'GET') {
      throw new ForbiddenException('API keys may only be used for GET requests.');
    }

    const clientIp = request[CLIENT_IP_KEY];
    const user = await this.apiKeysService.validateApiKey(apiKeyHeader, clientIp);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return true;
  }
}
