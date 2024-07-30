import { NestExpressApplication } from '@nestjs/platform-express';

import * as request from 'supertest';

import { closeApp, createNestApp } from '../utils';
import { getCookieRaw } from '../utils/httpUtils';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let authCookie: string;

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await closeApp(app);
  });

  it('/auth/login (POST) should login as admin', async () => {
    const res = await request(server)
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: '1234567890',
      })
      .expect(200);

    authCookie = getCookieRaw(res, 'Authentication');
  });

  it('/auth/signup (POST) should register new user if sender is admin', () => {
    return request(server)
      .post('/auth/signup')
      .set('Cookie', authCookie)
      .send({
        email: 'some.valid.email@test.com',
      })
      .expect(201);
  });

  it('/auth/signup (POST) should not register new user if sender is NOT admin', () => {
    return request(server)
      .post('/auth/signup')
      .send({
        email: 'some.valid.email@test.com',
      })
      .expect(401);
  });
});
