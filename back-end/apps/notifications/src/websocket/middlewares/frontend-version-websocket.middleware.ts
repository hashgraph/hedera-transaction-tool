import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import * as semver from 'semver';

export type SocketIOMiddleware = {
  (client: Socket, next: (err?: Error) => void);
};

const logger = new Logger('FrontendVersionWebsocketMiddleware');

export const FrontendVersionWebsocketMiddleware = (
  minimumSupportedVersion: string,
): SocketIOMiddleware => {
  const cleanMinimumVersion = semver.clean(minimumSupportedVersion);

  if (!cleanMinimumVersion) {
    logger.error(`Invalid MINIMUM_SUPPORTED_FRONTEND_VERSION format: "${minimumSupportedVersion}"`);
    throw new Error(
      `Invalid MINIMUM_SUPPORTED_FRONTEND_VERSION format: "${minimumSupportedVersion}". ` +
        'Please provide a valid semver version (e.g., "1.0.0").',
    );
  }

  return (socket: Socket, next) => {
    const ip = socket.handshake.address;

    const frontendVersion =
      socket.handshake.headers['x-frontend-version'] || socket.handshake.auth?.version;

    const isMissingVersion =
      !frontendVersion || (Array.isArray(frontendVersion) && frontendVersion.length === 0);

    if (isMissingVersion) {
      logger.warn(`Connection rejected: Missing frontend version from IP ${ip}`);
      return next(new Error('Frontend version is required. Please update your application.'));
    }

    const version = Array.isArray(frontendVersion) ? frontendVersion[0] : frontendVersion;
    const cleanFrontendVersion = semver.clean(version);

    if (!cleanFrontendVersion) {
      logger.warn(
        `Connection rejected: Invalid frontend version format "${version}" from IP ${ip}`,
      );
      return next(new Error('Invalid frontend version format. Please update your application.'));
    }

    if (semver.lt(cleanFrontendVersion, cleanMinimumVersion)) {
      logger.warn(
        `Connection rejected: Frontend version ${cleanFrontendVersion} is below minimum ${cleanMinimumVersion} from IP ${ip}`,
      );
      return next(
        new Error(
          `Your application version (${cleanFrontendVersion}) is no longer supported. ` +
            `Minimum required version is ${cleanMinimumVersion}. Please update your application.`,
        ),
      );
    }

    next();
  };
};
