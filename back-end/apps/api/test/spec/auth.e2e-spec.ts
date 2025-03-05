import { NestExpressApplication } from '@nestjs/platform-express';
import { ClientProxy } from '@nestjs/microservices';
import * as request from 'supertest';

import { totp } from 'otplib';

import { API_SERVICE } from '@app/common';
import { User, UserStatus } from '@entities';

import { closeApp, createNestApp } from '../utils';
import { Endpoint } from '../utils/httpUtils';
import { hash } from '../utils/crypto';
import { getRepository, getUser, resetDatabase, resetUsersState } from '../utils/databaseUtil';

import { admin, dummy, dummyNew, invalidEmail, validEmail } from '../utils/constants';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let client: ClientProxy;

  let adminAuthToken: string;
  let userAuthToken: string;
  let unverifiedOTPToken: string;
  let verifiedOTPToken: string;

  beforeAll(async () => {
    await resetDatabase();

    app = await createNestApp();
    server = app.getHttpServer();

    client = app.get<ClientProxy>(API_SERVICE);
    await client.connect();
  });

  afterAll(async () => {
    try {
      client.close();
    } catch (error) {
      console.log('Error closing client', error);
    }
    await closeApp(app);
  });

  describe('/auth/login', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/login');
    });

    it('(POST) should login as admin', async () => {
      const { body } = await endpoint
        .post({
          email: admin.email,
          password: admin.password,
        })
        .expect(200);

      adminAuthToken = body.accessToken;
    });

    it('(POST) should login as regular user', async () => {
      const { body } = await endpoint
        .post({
          email: dummy.email,
          password: dummy.password,
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toEqual({
            user: {
              id: expect.any(Number),
              email: dummy.email,
              createdAt: expect.any(String),
              admin: false,
              status: UserStatus.NONE,
              updatedAt: expect.any(String),
              deletedAt: null,
              keys: expect.any(Array),
            },
            accessToken: expect.any(String),
          });
        });

      userAuthToken = body.accessToken;
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

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/signup');
    });

    it('(POST) should register new user if sender is admin', () => {
      return endpoint
        .post(
          {
            email: validEmail,
          },
          null,
          adminAuthToken,
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

    it("(POST) should restore deleted user's account", async () => {
      const userRepo = await getRepository(User);
      const usersEndpoint = new Endpoint(server, '/users');
      const loginEndpoint = new Endpoint(server, '/auth/login');

      const user = await getUser('userNew');

      await usersEndpoint.delete(`${user.id}`, adminAuthToken).expect(200);

      await endpoint
        .post({ email: user.email }, null, adminAuthToken)
        .expect(201)
        .then(res => {
          expect(res.body).toEqual({
            id: expect.any(Number),
            email: user.email,
            createdAt: user.createdAt.toISOString(),
          });
        });

      const hashed = await hash(dummyNew.password);
      await userRepo.update({ id: user.id }, { password: hashed });

      await loginEndpoint.post({ email: user.email, password: dummyNew.password }).expect(200);
    });

    it('(POST) should update password and resend email if users status is NEW and the sender is an admin', async () => {
      const userRepo = await getRepository(User);

      const user = await getUser('userNew');

      await endpoint
        .post({ email: user.email }, null, adminAuthToken)
        .expect(201)
        .then(res => {
          expect(res.body).toEqual({
            email: user.email,
            createdAt: expect.any(String),
            id: expect.any(Number),
          });
        });

      const updatedUser = await userRepo.findOne({ where: { email: user.email } });

      expect(updatedUser).toBeDefined();
      expect(updatedUser?.password).not.toBe(user.password);
      expect(updatedUser?.status).toBe(UserStatus.NEW);
    });

    it('(POST) should not register new user if already exists', async () => {
      const user = await getUser('user');
      await endpoint
        .post(
          {
            email: user.email,
          },
          null,
          adminAuthToken,
        )
        .expect(422);
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
          null,
          userAuthToken,
        )
        .expect(403);
    });

    it('(POST) should throw on invalid email', async () => {
      await endpoint
        .post(
          {
            email: invalidEmail,
          },
          null,
          adminAuthToken,
        )
        .expect(400);
    });

    it('(POST) should throw on missing email', async () => {
      await endpoint
        .post({}, null, adminAuthToken)
        .expect(400)
        .expect({ statusCode: 400, message: 'No email specified.' });
    });
  });

  describe('/auth/change-password', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/change-password');
    });

    afterAll(async () => {
      await resetUsersState();
    });

    it('(PATCH) should change password', async () => {
      await endpoint
        .patch(
          {
            oldPassword: dummy.password,
            newPassword: 'newPassword',
          },
          null,
          userAuthToken,
        )
        .expect(200);
    });

    it('(PATCH) should not change password if not logged in', async () => {
      await endpoint.patch({}).expect(401).expect({ statusCode: 401, message: 'Unauthorized' });
    });

    it('(PATCH) should not change password if old password is invalid', async () => {
      await endpoint
        .patch(
          {
            oldPassword: 'invalid',
            newPassword: 'newPassword',
          },
          null,
          userAuthToken,
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
          null,
          userAuthToken,
        )
        .expect(400);
    });
  });

  describe('/auth/elevate-admin', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/elevate-admin');
    });

    it('(PATCH) should register new user if sender is admin', async () => {
      const user = await getUser('userNew');

      return endpoint.patch({ id: user.id }, null, adminAuthToken).expect(200);
    });

    it('(PATCH) should not register new user if sender is NOT admin', async () => {
      const user = await getUser('userNew');

      return endpoint.patch({ id: user.id }, null, userAuthToken).expect(403);
    });

    it('(PATCH) should throw on invalid user id', async () => {
      await endpoint.patch({ id: 333333 }, null, adminAuthToken).expect(400);
    });
  });

  describe('/auth/logout', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/logout');
    });

    it('(POST) should mark the token as blacklisted', async () => {
      await endpoint.post({}, null, userAuthToken).expect(200);
      await request(server).get('/transactions/history?page=1&size=99').expect(401);
    });

    it('(POST) should not logout if not logged in', async () => {
      await endpoint.post({}).expect(401);
    });
  });

  describe('/auth/reset-password', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/reset-password');
    });

    it('(POST) should request OTP', async () => {
      const res = await endpoint.post({ email: dummy.email }).expect(200);

      unverifiedOTPToken = res.body.token;

      expect(unverifiedOTPToken).toBeDefined();
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

    beforeAll(() => {
      endpoint = new Endpoint(server, '/auth/verify-reset');
    });

    it('(POST) should verify OTP', async () => {
      const token = totp.generate(`${process.env.OTP_SECRET}${dummy.email}`);

      const { body } = await request(server)
        .post('/auth/verify-reset')
        .send({ token })
        .set('otp', unverifiedOTPToken)
        .expect(200);

      verifiedOTPToken = body.token;

      expect(verifiedOTPToken).toBeDefined();
    });

    it('(POST) should blacklist OTP token after verification', async () => {
      const token = totp.generate(`${process.env.OTP_SECRET}${dummy.email}`);

      await request(server)
        .post('/auth/verify-reset')
        .send({ token })
        .set('otp', unverifiedOTPToken)
        .expect(401)
        .expect({ message: 'Unauthorized', statusCode: 401 });
    });

    it('(POST) should not verify OTP with invalid token', async () => {
      await request(server)
        .post('/auth/verify-reset')
        .send({ token: 'invalid token' })
        .set('otp', unverifiedOTPToken)
        .expect(401)
        .expect({ message: 'Unauthorized', statusCode: 401 });
    });

    it('(POST) should not verify OTP without OTP token', async () => {
      await endpoint.post({}).expect(401).expect({ statusCode: 401, message: 'Unauthorized' });
    });
  });

  describe('/auth/set-password', () => {
    afterAll(async () => {
      await resetUsersState();
    });

    it('(PATCH) should not set password with invalid password', async () => {
      await request(server)
        .patch('/auth/set-password')
        .send({ password: 'short' })
        .set('otp', verifiedOTPToken)
        .expect(400);
    });

    it('(PATCH) should not set password with missing password', async () => {
      await request(server)
        .patch('/auth/set-password')
        .send({})
        .set('otp', verifiedOTPToken)
        .expect(400);
    });
    it('(PATCH) should set password', async () => {
      await request(server)
        .patch('/auth/set-password')
        .send({ password: 'newPassword' })
        .set('otp', verifiedOTPToken)
        .expect(200);
    });

    it('(PATCH) should blacklist OTP token after setting password', async () => {
      await request(server)
        .patch('/auth/set-password')
        .send({ password: 'newPassword' })
        .set('otp', verifiedOTPToken)
        .expect(401)
        .expect({ statusCode: 401, message: 'Unauthorized' });
    });

    it('(PATCH) should not set password without OTP token', async () => {
      await request(server)
        .patch('/auth/set-password')
        .expect(401)
        .expect({ statusCode: 401, message: 'Unauthorized' });
    });

    it('(PATCH) should not set password with invalid OTP', async () => {
      await request(server)
        .patch('/auth/set-password')
        .send({ password: 'newPassword' })
        .set('otp', unverifiedOTPToken)
        .expect(401)
        .expect({ statusCode: 401, message: 'Unauthorized' });
    });
  });

  describe('authenticate-websocket-token', () => {
    it('should authenticate user', done => {
      client
        .send('authenticate-websocket-token', {
          jwt: userAuthToken,
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
