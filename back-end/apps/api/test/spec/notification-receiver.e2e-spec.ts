import { NestExpressApplication } from '@nestjs/platform-express';
import { EntityManager } from 'typeorm';

import { NotificationReceiver, NotificationType, User } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import { addNotifications, getUser, resetDatabase } from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';

describe('Notification Receiver (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let entityManager: EntityManager;

  let userAuthToken: string;
  let admin: User;
  let user: User;

  beforeAll(async () => {
    await resetDatabase();
    await addNotifications();

    app = await createNestApp();
    server = app.getHttpServer();

    entityManager = app.get(EntityManager);

    userAuthToken = await login(app, 'user');

    admin = await getUser('admin');
    user = await getUser('user');
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('/notifications', () => {
    let endpoint: Endpoint;

    beforeAll(async () => {
      endpoint = new Endpoint(server, '/notifications');
    });

    it('(GET) should return user notifications', async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: { userId: user.id },
      });

      const { status, body } = await endpoint.get(null, userAuthToken, '?page=1&size=10');

      expect(status).toBe(200);
      expect(body.totalItems).toEqual(notificationForUser.length);
      expect(body.page).toEqual(1);
      expect(body.size).toEqual(10);
    });

    it('(GET) should return user notifications filtered', async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: { userId: user.id, isRead: false },
      });

      const { status, body } = await endpoint.get(
        null,
        userAuthToken,
        '?page=1&size=10&filter=isRead:eq:false',
      );

      expect(status).toBe(200);
      expect(body.totalItems).toEqual(notificationForUser.length);
      expect(body.page).toEqual(1);
      expect(body.size).toEqual(10);
    });

    it('(GET) should return user notifications by type', async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: {
          userId: user.id,
          notification: {
            type: NotificationType.TRANSACTION_CREATED,
          },
        },
      });

      const { status, body } = await endpoint.get(
        null,
        userAuthToken,
        '?page=1&size=10&filter=type:eq:TRANSACTION_CREATED',
      );

      expect(status).toBe(200);
      expect(body.totalItems).toEqual(notificationForUser.length);
      expect(body.page).toEqual(1);
      expect(body.size).toEqual(10);
    });
  });

  describe('/notifications/count', () => {
    let endpoint: Endpoint;

    beforeAll(async () => {
      endpoint = new Endpoint(server, '/notifications/count');
    });

    it('(GET) should return user notifications count', async () => {
      const countForUser = await entityManager.count(NotificationReceiver, {
        where: { userId: user.id },
      });

      const { status, text } = await endpoint.get(null, userAuthToken);

      expect(status).toBe(200);
      expect(text).toBe(countForUser.toString());
    });

    it('(GET) should return user notifications count with a filter', async () => {
      const countForUser = await entityManager.count(NotificationReceiver, {
        where: { userId: user.id, isRead: false },
      });

      const { status, text } = await endpoint.get(null, userAuthToken, '?filter=isRead:eq:false');

      expect(status).toBe(200);
      expect(text).toBe(countForUser.toString());
    });

    it('(GET) should return user notifications by type', async () => {
      const countForUser = await entityManager.count(NotificationReceiver, {
        where: {
          userId: user.id,
          notification: {
            type: NotificationType.TRANSACTION_CREATED,
          },
        },
      });

      const { status, text } = await endpoint.get(
        null,
        userAuthToken,
        '?filter=type:eq:TRANSACTION_CREATED',
      );

      expect(status).toBe(200);
      expect(text).toBe(countForUser.toString());
    });
  });

  describe('/notifications/:id', () => {
    let endpoint: Endpoint;

    beforeAll(async () => {
      endpoint = new Endpoint(server, '/notifications');
    });

    it('(GET) should return user notification', async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: { userId: user.id },
        relations: {
          notification: true,
        },
      });
      expect(notificationForUser.length).toBeGreaterThan(0);

      const { status, body } = await endpoint.get(`${notificationForUser[0].id}`, userAuthToken);

      expect(status).toBe(200);
      expect(body.id).toEqual(notificationForUser[0].id);
      expect(body.isRead).toEqual(notificationForUser[0].isRead);
      expect(body.notification).toEqual(
        expect.objectContaining({
          additionalData: notificationForUser[0].notification.additionalData,
          type: notificationForUser[0].notification.type,
        }),
      );
    });

    it("(GET) should NOT return other user's notification", async () => {
      const notificationForAdmin = await entityManager.find(NotificationReceiver, {
        where: { userId: admin.id },
      });
      expect(notificationForAdmin.length).toBeGreaterThan(0);

      const { status } = await endpoint.get(`${notificationForAdmin[0].id}`, userAuthToken);

      expect(status).toBe(400);
    });

    it("(PATCH) should mark user's notification as read", async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: { userId: user.id },
      });
      expect(notificationForUser.length).toBeGreaterThan(0);
      expect(notificationForUser[0].isRead).toEqual(false);

      const { status, body } = await endpoint.patch(
        { isRead: true },
        `${notificationForUser[0].id}`,
        userAuthToken,
      );

      const notification = await entityManager.findOne(NotificationReceiver, {
        where: { id: notificationForUser[0].id },
      });

      expect(status).toBe(200);
      expect(body.id).toEqual(notificationForUser[0].id);
      expect(body.isRead).toEqual(true);
      expect(notification.isRead).toEqual(true);
    });

    it("(PATCH) should NOT be able to mark other user's notification as read", async () => {
      const notificationForAdmin = await entityManager.find(NotificationReceiver, {
        where: { userId: admin.id },
      });
      expect(notificationForAdmin.length).toBeGreaterThan(0);
      expect(notificationForAdmin[0].isRead).toEqual(false);

      const { status } = await endpoint.patch(
        { isRead: true },
        `${notificationForAdmin[0].id}`,
        userAuthToken,
      );

      const notification = await entityManager.findOne(NotificationReceiver, {
        where: { id: notificationForAdmin[0].id },
      });

      expect(status).toBe(400);
      expect(notification.isRead).toEqual(false);
    });

    it("(DELETE) should delete user's notification", async () => {
      const notificationForUser = await entityManager.find(NotificationReceiver, {
        where: { userId: user.id },
      });
      expect(notificationForUser.length).toBeGreaterThan(0);

      const { status, text } = await endpoint.delete(`${notificationForUser[0].id}`, userAuthToken);

      const notification = await entityManager.findOne(NotificationReceiver, {
        where: { id: notificationForUser[0].id },
      });

      expect(status).toBe(200);
      expect(text).toEqual('true');
      expect(notification).toBeNull();
    });

    it("(DELETE) should NOT be able to delete other user's notification", async () => {
      const notificationForAdmin = await entityManager.find(NotificationReceiver, {
        where: { userId: admin.id },
      });
      expect(notificationForAdmin.length).toBeGreaterThan(0);

      const { status } = await endpoint.delete(`${notificationForAdmin[0].id}`, userAuthToken);

      const notification = await entityManager.findOne(NotificationReceiver, {
        where: { id: notificationForAdmin[0].id },
      });

      expect(status).toBe(400);
      expect(notification).toBeDefined();
    });
  });
});
