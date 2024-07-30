import { NestExpressApplication } from '@nestjs/platform-express';

import * as request from 'supertest';

import { closeApp, createNestApp } from '../utils';
import { getCookieRaw } from '../utils/httpUtils';
import { admin, dummy, invalidEmail, validEmail } from '../utils/constants';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let adminAuthCookie: string;
  let userAuthCookie: string;

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();
  });

  afterEach(async () => {
    await closeApp(app);
  });

  describe('/auth/login', () => {
    it('/auth/login (POST) should login as admin', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({
          email: admin.email,
          password: admin.password,
        })
        .expect(200);

      adminAuthCookie = getCookieRaw(res, 'Authentication');
    });

    it('/auth/login (POST) should login as regular user', async () => {
      const res = await request(server)
        .post('/auth/login')
        .send({
          email: dummy.email,
          password: dummy.password,
        })
        .expect(200);

      userAuthCookie = getCookieRaw(res, 'Authentication');
    });
  });

  describe('/auth/signup', () => {
    it('/auth/signup (POST) should register new user if sender is admin', () => {
      return request(server)
        .post('/auth/signup')
        .set('Cookie', adminAuthCookie)
        .send({
          email: validEmail,
        })
        .expect(201)
        .then(res => {
          expect(res.body).toEqual({
            id: expect.any(Number),
            email: validEmail,
            createdAt: expect.any(String),
          });
        });
    });

    it('/auth/signup (POST) should not register new user if sender is not logged', () => {
      return request(server)
        .post('/auth/signup')
        .send({
          email: validEmail,
        })
        .expect(401);
    });

    it('/auth/signup (POST) should not register new user if sender is NOT admin', () => {
      return request(server)
        .post('/auth/signup')
        .set('Cookie', userAuthCookie)
        .send({
          email: validEmail,
        })
        .expect(403);
    });

    it('/auth/signup (POST) should throw on invalid email', async () => {
      await request(server)
        .post('/auth/signup')
        .set('Cookie', adminAuthCookie)
        .send({
          email: invalidEmail,
        })
        .expect(400);
    });

    it('/auth/signup (POST) should throw on missing email', async () => {
      await request(server)
        .post('/auth/signup')
        .set('Cookie', adminAuthCookie)
        .send({})
        .expect(400)
        .expect({ statusCode: 400, message: 'No email specified.' });
    });
  });
});
