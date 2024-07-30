import { NestExpressApplication } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';

import { totp } from 'otplib';

import { API_SERVICE } from '@app/common';
import { UserStatus } from '@entities';

import { closeApp, createNestApp } from '../utils';
import { getCookieRaw, Endpoint, getCookieValue } from '../utils/httpUtils';
import { resetUsersPassword } from '../utils/databaseUtil';

import { admin, dummy, invalidEmail, validEmail } from '../utils/constants';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let client: ClientProxy;

  let adminAuthCookie: string;
  let userAuthCookie: string;
  let unverifiedOTPCookie: string;
  let verifiedOTPCookie: string;

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();

    client = app.get<ClientProxy>(API_SERVICE);
    await client.connect();
  });

  afterEach(async () => {
    try {
      client.close();
    } catch (error) {
      console.log('Error closing client', error);
    }
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
        .expect(200)
        .expect(res => {
          expect(res.body).toEqual({
            id: expect.any(Number),
            email: dummy.email,
            createdAt: expect.any(String),
            admin: false,
            status: UserStatus.NONE,
            updatedAt: expect.any(String),
            deletedAt: null,
          });
        });

      userAuthCookie = getCookieRaw(res, 'Authentication');
    });

    it('(POST) should not login with invalid email', async () => {
      await endpoint
        .post({
          email: invalidEmail,
          password: dummy.password,
        })
        .expect(401);
    });

    it('(POST) should not login with invalid password', async () => {
      await endpoint
        .post({
          email: dummy.email,
          password: 'invalid',
        })
        .expect(401);
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

  describe('/auth/logout', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/logout');
    });

    it('(POST) should logout', async () => {
      await endpoint.post({}, userAuthCookie).expect(200);
    });

    it('(POST) should not logout if not logged in', async () => {
      await endpoint.post({}).expect(401);
    });
  });

  describe('/auth/change-password', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/change-password');
    });

    afterAll(async () => {
      await resetUsersPassword();
    });

    it('(PATCH) should change password', async () => {
      await endpoint
        .patch(
          {
            oldPassword: dummy.password,
            newPassword: 'newPassword',
          },
          userAuthCookie,
        )
        .expect(200);
    });

    it('(PATCH) should not logout if not logged in', async () => {
      await endpoint.patch({}).expect(401).expect({ statusCode: 401, message: 'Unauthorized' });
    });

    it('(PATCH) should not change password if old password is invalid', async () => {
      await endpoint
        .patch(
          {
            oldPassword: 'invalid',
            newPassword: 'newPassword',
          },
          userAuthCookie,
        )
        .expect(400);
    });

    it('(PATCH) should not change password if old password is the same as new password', async () => {
      await endpoint
        .patch(
          {
            oldPassword: dummy.password,
            newPassword: dummy.password,
          },
          userAuthCookie,
        )
        .expect(400);
    });
  });

  describe('/auth/reset-password', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/reset-password');
    });

    it('(POST) should request OTP', async () => {
      const res = await endpoint.post({ email: dummy.email }).expect(200);

      unverifiedOTPCookie = getCookieRaw(res, 'otp');

      expect(unverifiedOTPCookie).toBeDefined();
    });

    it('(POST) should not request OTP for invalid email', async () => {
      await endpoint.post({ email: invalidEmail }).expect(400);
    });

    it('(POST) should not request OTP for missing email', async () => {
      await endpoint.post({}).expect(400);
    });
  });

  describe('/auth/verify-reset', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/verify-reset');
    });

    it('(POST) should verify OTP', async () => {
      const token = totp.generate(`${process.env.OTP_SECRET}${dummy.email}`);

      const res = await endpoint
        .post(
          {
            token,
          },
          unverifiedOTPCookie,
        )
        .expect(200);

      verifiedOTPCookie = getCookieRaw(res, 'otp');

      expect(verifiedOTPCookie).toBeDefined();
    });

    it('(POST) should not verify OTP with invalid token', async () => {
      await endpoint
        .post(
          {
            token: 'invalid',
          },
          unverifiedOTPCookie,
        )
        .expect(401)
        .expect({ message: 'Incorrect token', error: 'Unauthorized', statusCode: 401 });
    });

    it('(POST) should not verify OTP without OTP cookie', async () => {
      await endpoint.post({}).expect(401).expect({ statusCode: 401, message: 'Unauthorized' });
    });
  });

  describe('/auth/set-password', () => {
    let endpoint: Endpoint;

    beforeEach(() => {
      endpoint = new Endpoint(server, '/auth/set-password');
    });

    afterAll(async () => {
      await resetUsersPassword();
    });

    it('(PATCH) should set password', async () => {
      const res = await endpoint
        .patch(
          {
            password: 'newPassword',
          },
          verifiedOTPCookie,
        )
        .expect(200);

      const otpCookie = getCookieRaw(res, 'otp');
      expect(otpCookie).toContain('otp=;');
    });

    it('(PATCH) should not set password without OTP cookie', async () => {
      await endpoint.patch({}).expect(401).expect({ statusCode: 401, message: 'Unauthorized' });
    });

    it('(PATCH) should not set password with invalid password', async () => {
      await endpoint
        .patch(
          {
            password: 'short',
          },
          verifiedOTPCookie,
        )
        .expect(400);
    });

    it('(PATCH) should not set password with missing password', async () => {
      await endpoint.patch({}, verifiedOTPCookie).expect(400);
    });

    it('(PATCH) should not set password with invalid OTP', async () => {
      await endpoint
        .patch(
          {
            password: 'newPassword',
          },
          unverifiedOTPCookie,
        )
        .expect(401)
        .expect({ statusCode: 401, message: 'Unauthorized' });
    });
  });

  describe('authenticate-websocket-token', () => {
    it('should authenticate user', done => {
      client
        .send('authenticate-websocket-token', {
          jwt: getCookieValue(userAuthCookie),
        })
        .subscribe(value => {
          expect(value).toEqual({
            id: expect.any(Number),
            email: dummy.email,
            createdAt: expect.any(String),
          });

          done();
        });
    });

    it('should not authenticate user with invalid token', done => {
      client
        .send('authenticate-websocket-token', {
          jwt: 'invalid',
        })
        .subscribe({
          next: () => {
            throw new Error('Should not authenticate');
          },
          error: () => done(),
        });
    });
  });
});
