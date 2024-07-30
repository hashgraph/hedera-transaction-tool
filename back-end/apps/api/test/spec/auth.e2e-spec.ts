import { NestExpressApplication } from '@nestjs/platform-express';

import { closeApp, createNestApp } from '../utils';
import { admin, dummy, invalidEmail, validEmail } from '../utils/constants';
import { getCookieRaw, Endpoint } from '../utils/httpUtils';

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
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/login');
    });

    it('(POST) should login as admin', async () => {
      const res = await endpoint
        .post({
          email: admin.email,
          password: admin.password,
        })
        .expect(200);

      adminAuthCookie = getCookieRaw(res, 'Authentication');
    });

    it('(POST) should login as regular user', async () => {
      const res = await endpoint
        .post({
          email: dummy.email,
          password: dummy.password,
        })
        .expect(200);

      userAuthCookie = getCookieRaw(res, 'Authentication');
    });
  });

  describe('/auth/signup', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/signup');
    });

    it('(POST) should register new user if sender is admin', () => {
      return endpoint
        .post(
          {
            email: validEmail,
          },
          adminAuthCookie,
        )
        .expect(201)
        .then(res => {
          expect(res.body).toEqual({
            id: expect.any(Number),
            email: validEmail,
            createdAt: expect.any(String),
          });
        });
    });

    it('(POST) should not register new user if sender is not logged', () => {
      return endpoint
        .post({
          email: validEmail,
        })
        .expect(401);
    });

    it('(POST) should not register new user if sender is NOT admin', () => {
      return endpoint
        .post(
          {
            email: validEmail,
          },
          userAuthCookie,
        )
        .expect(403);
    });

    it('(POST) should throw on invalid email', async () => {
      await endpoint
        .post(
          {
            email: invalidEmail,
          },
          adminAuthCookie,
        )
        .expect(400);
    });

    it('(POST) should throw on missing email', async () => {
      await endpoint
        .post({}, adminAuthCookie)
        .expect(400)
        .expect({ statusCode: 400, message: 'No email specified.' });
    });
  });
});
