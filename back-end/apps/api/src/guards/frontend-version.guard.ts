import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CLIENT_IP_KEY } from '@app/common';
import * as semver from 'semver';

import { ALLOW_API_KEY } from '../decorators';

@Injectable()
export class FrontendVersionGuard implements CanActivate {
  private readonly logger = new Logger(FrontendVersionGuard.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  private getUpdateUrl(): string | null {
    const repoUrl = this.configService.get<string>('FRONTEND_REPO_URL');
    const latestVersion = this.configService.get<string>('LATEST_SUPPORTED_FRONTEND_VERSION');

    if (!repoUrl || !latestVersion) {
      return null;
    }

    const cleanLatest = semver.clean(latestVersion);
    if (!cleanLatest) {
      return null;
    }

    const baseUrl = repoUrl.replace(/\/+$/, '');

    return `${baseUrl}/download/v${cleanLatest}/`;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = request[CLIENT_IP_KEY] || 'unknown';

    // Third-party API key consumers (e.g. the read-only report API) aren't the
    // frontend application this guard is policing. A route that opted into key
    // auth via @AllowApiKey(), combined with a presented key, is enough to skip
    // version enforcement here - whether the key is actually valid is
    // JwtOrApiKeyGuard's job, which runs later and rejects a junk key with 401
    // rather than falling through to a misleading "update your frontend"
    // response. On a route without @AllowApiKey(), the header is irrelevant
    // here and the auth guard rejects the key as not allowed on that route.
    const allowApiKey = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowApiKey && request.headers['x-api-key']) {
      return true;
    }

    const frontendVersion = request.headers['x-frontend-version'];
    const minimumVersion = this.configService.get<string>('MINIMUM_SUPPORTED_FRONTEND_VERSION');
    const latestVersion = this.configService.get<string>('LATEST_SUPPORTED_FRONTEND_VERSION');

    const UPGRADE_REQUIRED = 426;
    const updateUrl = this.getUpdateUrl();

    if (!frontendVersion) {
      this.logger.warn(`Request rejected: Missing x-frontend-version header from IP ${clientIp}`);
      throw new HttpException(
        {
          statusCode: UPGRADE_REQUIRED,
          message: 'Frontend version header is required. Please update your application.',
          error: 'Upgrade Required',
          updateUrl,
        },
        UPGRADE_REQUIRED,
      );
    }

    const cleanFrontendVersion = semver.clean(frontendVersion);
    const cleanMinimumVersion = minimumVersion != null ? semver.clean(minimumVersion) : null;

    if (!cleanFrontendVersion) {
      this.logger.warn(
        `Request rejected: Invalid frontend version format "${frontendVersion}" from IP ${clientIp}`,
      );

      throw new HttpException(
        {
          statusCode: UPGRADE_REQUIRED,
          message: 'Invalid frontend version format. Please update your application.',
          error: 'Upgrade Required',
          updateUrl,
        },
        UPGRADE_REQUIRED,
      );
    }

    if (!cleanMinimumVersion) {
      this.logger.error(`Invalid MINIMUM_SUPPORTED_FRONTEND_VERSION format: "${minimumVersion}"`);
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Server configuration error: Invalid minimum supported frontend version format.',
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (semver.lt(cleanFrontendVersion, cleanMinimumVersion)) {
      this.logger.warn(
        `Request rejected: Frontend version ${cleanFrontendVersion} is below minimum ${cleanMinimumVersion} from IP ${clientIp}`,
      );
      throw new HttpException(
        {
          statusCode: UPGRADE_REQUIRED,
          message: `Your application version (${cleanFrontendVersion}) is no longer supported. Minimum required version is ${cleanMinimumVersion}. Please update your application.`,
          error: 'Upgrade Required',
          minimumSupportedVersion: cleanMinimumVersion,
          latestSupportedVersion: latestVersion,
          updateUrl,
        },
        UPGRADE_REQUIRED,
      );
    }

    return true;
  }
}
