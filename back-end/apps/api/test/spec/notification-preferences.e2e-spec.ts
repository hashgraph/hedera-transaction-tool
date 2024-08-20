import { NestExpressApplication } from '@nestjs/platform-express';
import { EntityManager } from 'typeorm';

import { NotificationPreferences, NotificationType, User } from '@entities';

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

  const getPreferences = async (userId: number, type?: NotificationType) => {
    if (type) {
      return await entityManager.findOne(NotificationPreferences, { where: { userId, type } });
    }
    return await entityManager.find(NotificationPreferences, { where: { userId } });
  };

  describe('notification-preferences', () => {
    let endpoint: Endpoint;

    beforeEach(async () => {
      endpoint = new Endpoint(server, `/notification-preferences`);
    });

    it('(PATCH) should create the preferences if does not exist', async () => {
      let preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);
      expect(preferences).toBeNull();

      const { status, body } = await endpoint.patch(
        {
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        },
        null,
        userAuthCookie,
      );

      preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        }),
      );
    });

    it('(PATCH) should update the preferences', async () => {
      const { status, body } = await endpoint.patch(
        {
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: false,
          inApp: false,
        }),
      );
    });

    it('(PATCH) should update the preferences if only email field is passed', async () => {
      const { status, body } = await endpoint.patch(
        {
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: false,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: false,
        }),
      );
    });

    it('(PATCH) should update the preferences if only inApp field is passed', async () => {
      const { status, body } = await endpoint.patch(
        {
          type: NotificationType.TRANSACTION_CREATED,
          inApp: true,
        },
        null,
        userAuthCookie,
      );

      const preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: true,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: true,
        }),
      );
    });

    it('(PATCH) should NOT update the preferences if no email or inApp is passed', async () => {
      const { status, body } = await endpoint
        .patch(
          {
            type: NotificationType.TRANSACTION_CREATED,
          },
          null,
          userAuthCookie,
        )
        .expect(200);

      const preferences = await getPreferences(user.id, NotificationType.TRANSACTION_CREATED);

      expect(status).toBe(200);
      expect(body).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: true,
        }),
      );
      expect(preferences).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: true,
        }),
      );
    });

    it('(PATCH) should throw if invalid body is passed', async () => {
      await endpoint.patch({ email: 'sad' }, null, userAuthCookie).expect(400);

      await endpoint.patch({ inApp: 'sad' }, null, userAuthCookie).expect(400);

      await endpoint.patch({ email: true, inApp: false }, null, userAuthCookie).expect(400);
    });

    it('(PATCH) should NOT update the preferences if the user is not authenticated', async () => {
      await endpoint.patch({ email: true }, null).expect(401);
    });

    it('(PATCH) should NOT update the preferences if the user is not verified', async () => {
      await endpoint
        .patch(
          {
            email: true,
          },
          null,
          userNewAuthCookie,
        )
        .expect(403);
    });

    it('(GET) should create the preferences if they do not exist', async () => {
      let preferences = await getPreferences(admin.id);
      expect(preferences).toEqual([]);

      const { status, body } = await endpoint.get(null, adminAuthCookie);
      preferences = await getPreferences(admin.id);

      expect(status).toBe(200);
      expect(body.length).toBe(Object.values(NotificationType).length);

      for (let i = 0; i < Object.values(NotificationType).length; i++) {
        const type = Object.values(NotificationType)[i];

        expect(body[i]).toEqual(
          expect.objectContaining({
            userId: admin.id,
            type,
            email: true,
            inApp: true,
          }),
        );
      }
    });

    it('(GET) should return the preferences', async () => {
      const preferences = await getPreferences(user.id);

      const { status, body } = await endpoint.get(null, userAuthCookie);

      expect(status).toBe(200);
      expect(body.length).toBe(Object.values(NotificationType).length);
      expect(body[0]).toEqual(
        expect.objectContaining({
          userId: user.id,
          type: preferences[0].type,
          email: preferences[0].email,
          inApp: preferences[0].inApp,
        }),
      );
    });

    it('(GET) should return the preferences for a given type', async () => {
      const { status, body } = await endpoint.get(
        null,
        userAuthCookie,
        '?type=TRANSACTION_CREATED',
      );

      expect(status).toBe(200);
      expect(body).toEqual([
        expect.objectContaining({
          userId: user.id,
          type: NotificationType.TRANSACTION_CREATED,
          email: true,
          inApp: true,
        }),
      ]);
    });

    it('(GET) should throw if invalid query is passed', async () => {
      await endpoint.get(null, userAuthCookie, '?type=INVALID').expect(400);
    });

    it('(GET) should not return the preferences if the user is not authenticated', async () => {
      await endpoint.get(null).expect(401);
    });

    it('(GET) should not return the preferences if the user is not verified', async () => {
      await endpoint.get(null, userNewAuthCookie).expect(403);
    });
  });
});
