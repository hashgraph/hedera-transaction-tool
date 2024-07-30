import { NestExpressApplication } from '@nestjs/platform-express';

import { User } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import { getUser, getUserKeys, resetDatabase, resetUsersState } from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { generatePrivateKey } from '../utils/hederaUtils';

import { MAX_USER_KEYS } from '../../src/user-keys/user-keys.service';

describe('User Keys (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

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

  describe('user/:id/keys', () => {
    let endpoint: Endpoint;

    beforeEach(async () => {
      endpoint = new Endpoint(server, `/user`);
    });

    it('(GET) should get keys of other user if verified', async () => {
      const res = await endpoint.get('/1/keys', userAuthCookie).expect(200);

      const actualUserKeys = await getUserKeys(1);

      expect(res.body).toHaveLength(actualUserKeys.length);
    });

    it('(GET) should get users keys if verified', async () => {
      const res = await endpoint.get('/2/keys', userAuthCookie).expect(200);

      const actualUserKeys = await getUserKeys(2);

      expect(res.body).toHaveLength(actualUserKeys.length);
    });

    it('(GET) should not be able to get user keys if not verified', async () => {
      await endpoint.get('/2/keys', userNewAuthCookie).expect(403);
    });

    it('(GET) should not be able to get user keys if not logged in', async () => {
      await endpoint.get('/2/keys').expect(401);
    });

    it('(POST) should upload your key if verified whatever user id is passed', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/123123123/keys', userAuthCookie)
        .expect(201);

      const { publicKeyRaw: publicKeyRaw2 } = await generatePrivateKey();

      await endpoint.post({ publicKey: publicKeyRaw2 }, '/5134/keys', userAuthCookie).expect(201);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys).toHaveLength(3); // 2 keys + 1 default key
    });

    it('(POST) should not be able to upload key if not verified', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userNewAuthCookie)
        .expect(403);
    });

    it('(POST) should not be able to upload key if not logged in', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys').expect(401);
    });

    it('(POST) should not be able to upload key if invalid body', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({}, '/2/keys', userAuthCookie).expect(400);

      await endpoint.post({ mnemonicHash }, '/2/keys', userAuthCookie).expect(400);

      await endpoint.post({ index }, '/2/keys', userAuthCookie).expect(400);

      await endpoint.post({ mnemonicHash, index }, '/2/keys', userAuthCookie).expect(400);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw }, '/2/keys', userAuthCookie)
        .expect(400);

      await endpoint
        .post({ publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(400);
    });

    it('(POST) should not update mnemonic if uploading existing key and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(201);

      await endpoint
        .post({ mnemonicHash: '123', publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(400);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].mnemonicHash).toEqual(mnemonicHash);
    });

    it('(POST) should not update index if uploading existing key and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(201);

      const newIndex = 123;

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index: newIndex }, '/2/keys', userAuthCookie)
        .expect(400);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].index).toEqual(index);
    });

    it('(POST) should set mnemonic if uploading existing key and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthCookie).expect(201);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(201);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].mnemonicHash).toEqual(mnemonicHash);
      expect(actualUserKeys[actualUserKeys.length - 1].index).toEqual(index);
    });

    it('(POST) should not be able to upload key already added key by other user', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthCookie)
        .expect(201);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', adminAuthCookie)
        .expect(400);
    });

    it('(POST) should not be able to upload key if user already has max keys', async () => {
      let userKeys = await getUserKeys(user.id);

      const keysToAdd = MAX_USER_KEYS - userKeys.length;

      const keysPromises = Array.from({ length: keysToAdd }, async () => generatePrivateKey());
      const keys = await Promise.all(keysPromises);

      for (const key of keys) {
        await endpoint.post({ publicKey: key.publicKeyRaw }, '/2/keys', userAuthCookie).expect(201);
      }

      const { publicKeyRaw } = await generatePrivateKey();

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthCookie).expect(400);

      userKeys = await getUserKeys(user.id);

      for (const key of userKeys.slice(2, userKeys.length)) {
        await endpoint.delete(`/2/keys/${key.id}`, userAuthCookie);
      }
    });

    it('(POST) should recover key WITH mnemonic if key is deleted', async () => {
      const [{ id, publicKey, mnemonicHash, index }] = await getUserKeys(user.id);

      await endpoint.delete(`/2/keys/${id}`, userAuthCookie).expect(200);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKey, index }, '/2/keys', userAuthCookie)
        .expect(201);
    });

    it('(POST) should recover key WITHOUT mnemonic if key is deleted', async () => {
      const { publicKeyRaw } = await generatePrivateKey();
      let userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint
        .delete(`/2/keys/${userKeys[userKeys.length - 1].id}`, userAuthCookie)
        .expect(200);

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthCookie).expect(201);

      userKeys = await getUserKeys(user.id);
      await endpoint
        .delete(`/2/keys/${userKeys[userKeys.length - 1].id}`, userAuthCookie)
        .expect(200);

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthCookie).expect(201);
    });

    it("(DELETE) should delete user's key if verified", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userAuthCookie).expect(200);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys).toHaveLength(userKeys.length - 1);
    });

    it("(DELETE) should not delete user's key if not verified", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userNewAuthCookie).expect(403);
    });

    it("(DELETE) should not delete user's key if not logged in", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`).expect(401);
    });

    it('(DELETE) should not delete user key if invalid id', async () => {
      await endpoint.delete(`/2/keys/123`, userAuthCookie).expect(404);
    });

    it('(DELETE) should not delete another users key', async () => {
      const userKeys = await getUserKeys(admin.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userAuthCookie).expect(400);
    });
  });
});
