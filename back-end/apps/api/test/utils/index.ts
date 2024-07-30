import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';

import { API_SERVICE } from '@app/common';

import { admin, dummy, dummyNew } from './constants';

import { Endpoint, getCookieRaw } from './httpUtils';

import { ApiModule } from '../../src/api.module';
import { setupApp } from '../../src/setup-app';

export async function createNestApp() {
  const moduleFixtureBuilder = Test.createTestingModule({
    imports: [
      ApiModule,
      ClientsModule.registerAsync([
        {
          name: API_SERVICE,
          useFactory: (configService: ConfigService) => ({
            transport: Transport.TCP,
            options: {
              port: configService.get('TCP_PORT'),
            },
          }),
          inject: [ConfigService],
        },
      ]),
    ],
  });

  const moduleFixture = await moduleFixtureBuilder.compile();

  const app = moduleFixture.createNestApplication() as NestExpressApplication;

  setupApp(app, false);

  await app.startAllMicroservices();
  await app.init();

  return app;
}

export async function closeApp(app: NestExpressApplication) {
  if (!app) return;

  await app.close();
  const results = await Promise.allSettled([app.getMicroservices().map(ms => ms.close())]);

  results.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Error closing microservice', result.reason);
    }
  });
}

export async function login(
  app: NestExpressApplication,
  user: 'admin' | 'user' | 'userNew',
): Promise<string> {
  const endpoint = new Endpoint(app.getHttpServer(), '/auth/login');

  const email = user === 'admin' ? admin.email : user === 'user' ? dummy.email : dummyNew.email;
  const password =
    user === 'admin' ? admin.password : user === 'user' ? dummy.password : dummyNew.password;

  const res = await endpoint.post({
    email,
    password,
  });

  return getCookieRaw(res, 'Authentication');
}
