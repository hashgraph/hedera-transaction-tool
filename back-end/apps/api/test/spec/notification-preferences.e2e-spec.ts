import { NestExpressApplication } from '@nestjs/platform-express';
import { EntityManager } from 'typeorm';

import { NotificationPreferences, User } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import { getUser, resetDatabase, resetUsersState } from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';

describe('Notification Preferences (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let entityManager: EntityManager;

  let adminAuthCookie: string;
  let userAuthCookie: string;
  let userNewAuthCookie: string;
  let admin: User;
  let user: User;

  beforeAll(async () => {
    await resetDatabase();
  });

  beforeEach(async () => {
    app = await createNestApp();
    server = app.getHttpServer();

    entityManager = app.get(EntityManager);

    adminAuthCookie = await login(app, 'admin');
    userAuthCookie = await login(app, 'user');
    userNewAuthCookie = await login(app, 'userNew');

    admin = await getUser('admin');
    user = await getUser('user');
  });

  afterEach(async () => {
    await resetUsersState();
    await closeApp(app);
  });

  const getPreferences = async (userId: number) => {
    return await entityManager.findOne(NotificationPreferences, { where: { userId } });
  };

  describe('notification-preferences', () => {
    let endpoint: Endpoint;

    beforeEach(async () => {
      endpoint = new Endpoint(server, `/notification-preferences`);
    });

    it('(PATCH) should create the preferences if does not exist', async () => {
      let preferences = await getPreferences(user.id);
      expect(preferences).toBeNull();

      const { status, body } = await endpoint.patch(
        {
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        },
        null,
        userAuthCookie,
      );

      preferences = await getPreferences(user.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        }),
      );
    });

    it('(PATCH) should update the preferences', async () => {
      const { status, body } = await endpoint.patch(
        {
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: false,
          transactionReadyForExecution: false,
        }),
      );
    });

    it('(PATCH) should update the preferences if only required signature is passed', async () => {
      const { status, body } = await endpoint.patch(
        {
          transactionRequiredSignature: true,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: false,
        }),
      );
    });

    it('(PATCH) should update the preferences if only ready for execution is passed', async () => {
      const { status, body } = await endpoint.patch(
        {
          transactionReadyForExecution: true,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
    });

    it('(PATCH) should not update the preferences if no data is passed', async () => {
      const { status, body } = await endpoint.patch({}, null, userAuthCookie).expect(200);

      const preferences = await getPreferences(user.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
    });

    it('(PATCH) should throw if invalid body is passed', async () => {
      await endpoint
        .patch({ transactionRequiredSignature: 'sad' }, null, userAuthCookie)
        .expect(400);
    });

    it('(PATCH) should not update the preferences if the user is not authenticated', async () => {
      await endpoint.patch({ transactionRequiredSignature: true }, null).expect(401);
    });

    it('(PATCH) should not update the preferences if the user is not verified', async () => {
      await endpoint
        .patch(
          {
            transactionRequiredSignature: true,
          },
          null,
          userNewAuthCookie,
        )
        .expect(403);
    });

    it('(GET) should create the preferences if they do not exist', async () => {
      let preferences = await getPreferences(admin.id);
      expect(preferences).toBeNull();

      const { status, body } = await endpoint.get(null, adminAuthCookie);
      preferences = await getPreferences(admin.id);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: admin.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: admin.id,
          transactionRequiredSignature: true,
          transactionReadyForExecution: true,
        }),
      );
    });

    it('(GET) should return the preferences', async () => {
      const preferences = await getPreferences(user.id);

      const { status, body } = await endpoint.get(null, userAuthCookie);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          transactionRequiredSignature: preferences.transactionRequiredSignature,
          transactionReadyForExecution: preferences.transactionReadyForExecution,
        }),
      );
    });

    it('(GET) should not return the preferences if the user is not authenticated', async () => {
      await endpoint.get(null).expect(401);
    });

    it('(GET) should not return the preferences if the user is not verified', async () => {
      await endpoint.get(null, userNewAuthCookie).expect(403);
    });
  });
});
