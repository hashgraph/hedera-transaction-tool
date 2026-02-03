import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as semver from 'semver';

@Injectable()
export class FrontendVersionGuard implements CanActivate {
  private readonly logger = new Logger(FrontendVersionGuard.name);

  constructor(private readonly configService: ConfigService) {}

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

    return `${baseUrl}/v${cleanLatest}/`;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const frontendVersion = request.headers['x-frontend-version'];
    const minimumVersion = this.configService.get<string>('MINIMUM_SUPPORTED_FRONTEND_VERSION');
    const latestVersion = this.configService.get<string>('LATEST_SUPPORTED_FRONTEND_VERSION');
    const clientIp = request.headers['x-forwarded-for'] || request.ip || 'unknown';

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
    const cleanMinimumVersion = semver.clean(minimumVersion);

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
