import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { NestApplicationOptions } from '@nestjs/common';

import { ApiModule } from './api.module';
import { setupApp, setupSwagger } from './setup-app';

// Explicitly cap HTTP header size. Node.js default is 16KB; we match it here
// so the limit is visible in code rather than relying on an invisible runtime default.
const MAX_HEADER_SIZE = 16384;

async function bootstrap() {
  const app: NestExpressApplication = await createApp();

  setupApp(app);

  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  const configService = app.get(ConfigService);

  await app.startAllMicroservices();
  await app.listen(configService.get<string>('HTTP_PORT') ?? 3000);
}

async function createApp(): Promise<NestExpressApplication> {
  if (process.env.NODE_ENV === 'production') {
    return await createAppForDeployment();
  } else {
    return await createAppForDevelopment();
  }
}

function applyServerLimits(app: NestExpressApplication): void {
  // `https.Server` extends `http.Server`, so this works for both HTTP and HTTPS adapters.
  // `maxHeaderSize` is a real, mutable property Node's HTTP parser reads per-connection
  // (see https.ServerOptions/http.ServerOptions), but @types/node only types it as a
  // constructor option, not an instance property -- hence the extra cast.
  (app.getHttpAdapter().getHttpServer() as http.Server & { maxHeaderSize: number }).maxHeaderSize =
    MAX_HEADER_SIZE;
}

async function createAppForDeployment(): Promise<NestExpressApplication> {
  const app = (await NestFactory.create(ApiModule)) as NestExpressApplication;
  applyServerLimits(app);

  // This only affects the *fallback* path (req.ip, used when IpResolverService can't
  // resolve a trustworthy IP) and Express's own internal checks (req.secure, etc) --
  // it does not make req.ip trustworthy for rate limiting or anything security-
  // sensitive. That trust comes from the network boundary (Cloudflare mTLS enforced at
  // the ingress, configured separately in infra) plus IpResolverService reading
  // CF-Connecting-IP directly; see @app/common's ip-resolution module and @ClientIp().
  //
  // 'loopback'/'linklocal'/'uniquelocal' trust only private-network hops (i.e. the
  // in-cluster ingress), not arbitrary internet hosts, so this stays safe even though
  // it doesn't know Traefik's exact pod IP.
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  return app;
}

async function createAppForDevelopment(): Promise<NestExpressApplication> {
  const options: NestApplicationOptions = {};
  try {
    const key = fs.readFileSync(path.resolve(__dirname, '../../../cert/key.pem'));
    const cert = fs.readFileSync(path.resolve(__dirname, '../../../cert/cert.pem'));
    options.httpsOptions = { key, cert };
  } catch {
    console.warn('No self-signed SSL certificate found. Running in HTTP mode.');
  }

  const app = (await NestFactory.create(ApiModule, options)) as NestExpressApplication;
  applyServerLimits(app);
  return app;
}

bootstrap();
