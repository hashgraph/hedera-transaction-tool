import { NestExpressApplication } from '@nestjs/platform-express';

import * as request from 'supertest';

import { closeApp, createNestApp } from '../utils';

describe('API Health (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await closeApp(app);
  });

  it('/ (GET)', () => {
    return request(server).get('/').expect(200);
  });
});
