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

    it('(GET) should include clients with updateAvailable for admin after version-check', async () => {
      const versionEndpoint = new Endpoint(server, '/users/version-check');
      await versionEndpoint.post({ version: '0.9.0' }, null, userAuthToken).expect(201);

      const res = await endpoint.get(null, adminAuthToken).expect(200);

      const testUser = await getUser('user');
      const userInResponse = res.body.find((u: { id: number }) => u.id === testUser.id);
      expect(userInResponse).toBeDefined();
      expect(userInResponse.clients).toBeDefined();
      expect(userInResponse.clients).toHaveLength(1);
      expect(userInResponse.clients[0]).toMatchObject({
        version: '0.9.0',
        updateAvailable: true,
      });
    });

    it('(GET) should not include clients or updateAvailable for non-admin', async () => {
      const res = await endpoint.get(null, userAuthToken).expect(200);

      for (const u of res.body) {
        expect(u).not.toHaveProperty('updateAvailable');
        expect(u).not.toHaveProperty('clients');
      }
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
        keys: expect.any(Array),
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
        keys: expect.any(Array),
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

    it('(GET) should get a specific user with clients', async () => {
      const res = await endpoint.get('1', userAuthToken).expect(200);

      expect(res.body).toEqual({
        admin: true,
        id: 1,
        email: 'admin@test.com',
        status: 'NONE',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        deletedAt: null,
        keys: expect.any(Array),
        clients: expect.any(Array),
      });
    });

    it('(GET) should include client version info after version-check', async () => {
      const versionEndpoint = new Endpoint(server, '/users/version-check');
      await versionEndpoint.post({ version: '0.9.0' }, null, userAuthToken).expect(201);

      const user = await getUser('user');
      const res = await endpoint.get(user.id.toString(), userAuthToken).expect(200);

      expect(res.body.clients).toBeDefined();
      expect(res.body.clients).toHaveLength(1);
      expect(res.body.clients[0]).toMatchObject({
        version: '0.9.0',
        updateAvailable: true,
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
        keys: expect.any(Array),
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

  describe('/users/public-owner/:publicKey', () => {
    let endpoint: Endpoint;
    let testPublicKey: string;
    let testUserEmail: string;

    beforeAll(async () => {
      endpoint = new Endpoint(server, '/users/public-owner');

      // Fetch an existing test user with a public key
      const testUser = await getUser('user');

      if (!testUser || !testUser.keys.length) {
        throw new Error(
          'No test user with public keys found. Ensure test data is seeded properly.',
        );
      }

      testPublicKey = testUser.keys[0].publicKey;
      testUserEmail = testUser.email;
    });

    it('(GET) should return the owner of the public key', async () => {
      const res = await endpoint.get(testPublicKey, userAuthToken).expect(200);

      expect(res.body).toBe(testUserEmail);
    });

    it('(GET) should return null if the public key does not exist', async () => {
      const res = await endpoint.get('non-existing-public-key', userAuthToken).expect(200);

      expect(res.body).toBeNull();
    });

    it('(GET) should return 401 if not authenticated', async () => {
      await endpoint.get(testPublicKey).expect(401);
    });
  });
});
