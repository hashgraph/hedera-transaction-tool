import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';

import { ApiModule } from '../../src/api.module';

import { setupApp } from '../../src/setup-app';

export async function createNestApp() {
  const moduleFixtureBuilder = Test.createTestingModule({
    imports: [ApiModule],
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
