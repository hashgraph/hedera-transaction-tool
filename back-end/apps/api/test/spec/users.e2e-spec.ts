import { NestExpressApplication } from '@nestjs/platform-express';

import { closeApp, createNestApp, login } from '../utils';
import { Endpoint } from '../utils/httpUtils';
import { getUser, getUsers, resetDatabase, resetUsersState } from '../utils/databaseUtil';

describe('Users (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;
  let adminAuthToken: string;
  let userAuthToken: string;
  let userNewAuthToken: string;

  beforeAll(async () => {
    await resetDatabase();

    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthToken = await login(app, 'admin');
    userAuthToken = await login(app, 'user');
    userNewAuthToken = await login(app, 'userNew');
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('/users/', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/users');
    });

    it('(GET) should get users if verified', async () => {
      const res = await endpoint.get(null, userAuthToken).expect(200);

      const actualUsers = await getUsers();

      expect(res.body).toHaveLength(actualUsers.length);
    });

    it('(GET) should not be able to get users if not verified', async () => {
      await endpoint.get(null, userNewAuthToken).expect(403);
    });

    it('(GET) should not be able to get users if not logged in', async () => {
      await endpoint.get().expect(401);
    });
  });

  describe('/users/me', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/users/me');
    });

    it('(GET) should get the current user', async () => {
      const res = await endpoint.get(null, userAuthToken).expect(200);

      expect(res.body).toEqual({
        admin: false,
        id: expect.any(Number),
        email: 'dummy@test.com',
        status: 'NONE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
      });
    });

    it('(GET) should get the current user if not verified', async () => {
      const res = await endpoint.get(null, userNewAuthToken).expect(200);

      expect(res.body).toEqual({
        admin: false,
        id: expect.any(Number),
        email: 'dummyNew@test.com',
        status: 'NEW',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
      });
    });

    it('(GET) should not get the current user if not logged in', async () => {
      await endpoint.get().expect(401);
    });
  });

  describe('/users/:id', () => {
    let endpoint: Endpoint;

    beforeAll(() => {
      endpoint = new Endpoint(server, '/users');
    });

    it('(GET) should get a specific user', async () => {
      const res = await endpoint.get('1', userAuthToken).expect(200);

      expect(res.body).toEqual({
        admin: true,
        id: 1,
        email: 'admin@test.com',
        status: 'NONE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
      });
    });

    it('(GET) should not get a specific user if not verified', async () => {
      await endpoint.get('1', userNewAuthToken).expect(403);
    });

    it('(GET) should not get a specific user if not logged in', async () => {
      await endpoint.get('1').expect(401);
    });

    it("(PATCH) should update a user's admin status if admin", async () => {
      const res = await endpoint.patch({ admin: true }, '2', adminAuthToken).expect(200);

      expect(res.body).toEqual({
        admin: true,
        id: 2,
        email: 'dummy@test.com',
        status: 'NONE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
      });

      await resetUsersState();
      adminAuthToken = await login(app, 'admin');
      userAuthToken = await login(app, 'user');
      userNewAuthToken = await login(app, 'userNew');
    });

    it("(PATCH) should not update a user's admin status if not admin", async () => {
      await endpoint.patch({ admin: true }, '2', userAuthToken).expect(403);
    });

    it("(PATCH) should not update a user's admin status if incorrect data is sent", async () => {
      await endpoint.patch({ admin: 'asd' }, '2', adminAuthToken).expect(400);
    });

    it('(DELETE) should remove a user if admin', async () => {
      await endpoint.delete('2', adminAuthToken).expect(200);

      await resetUsersState();
      adminAuthToken = await login(app, 'admin');
    });

    it('(DELETE) should not remove a user if not admin', async () => {
      await endpoint.delete('2', userAuthToken).expect(403);
    });

    it('(DELETE) should not remove a user if not existing', async () => {
      await endpoint.delete('999999', adminAuthToken).expect(400);
    });

    it('(DELETE) should throw if a user id ', async () => {
      await endpoint.delete('asdasd', adminAuthToken).expect(400);
    });

    it('(DELETE) should throw if try to remove themselves', async () => {
      const admin = await getUser('admin');

      await endpoint.delete(admin.id.toString(), adminAuthToken).expect(400);
    });
  });
});
