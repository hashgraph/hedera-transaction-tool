import { NestExpressApplication } from '@nestjs/platform-express';

import { MAX_USER_KEYS } from '@app/common';
import { User } from '@entities';

import { closeApp, createNestApp, login } from '../utils';
import { getUser, getUserKeys, resetDatabase } from '../utils/databaseUtil';
import { Endpoint } from '../utils/httpUtils';
import { generatePrivateKey } from '../utils/hederaUtils';

describe('User Keys (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<typeof app.getHttpServer>;

  let adminAuthToken: string;
  let userAuthToken: string;
  let userNewAuthToken: string;
  let admin: User;
  let user: User;

  beforeAll(async () => {
    await resetDatabase();

    app = await createNestApp();
    server = app.getHttpServer();

    adminAuthToken = await login(app, 'admin');
    userAuthToken = await login(app, 'user');
    userNewAuthToken = await login(app, 'userNew');

    admin = await getUser('admin');
    user = await getUser('user');
  });

  afterAll(async () => {
    await closeApp(app);
  });

  describe('user/:id/keys', () => {
    let endpoint: Endpoint;

    beforeAll(async () => {
      endpoint = new Endpoint(server, `/user`);
    });

    it('(GET) should get keys of other user if verified', async () => {
      const res = await endpoint.get(`/${admin.id}/keys`, userAuthToken).expect(200);

      const actualUserKeys = await getUserKeys(1);

      expect(res.body).toHaveLength(actualUserKeys.length);
      res.body.forEach(key => {
        expect(key).not.toHaveProperty('mnemonicHash');
        expect(key).not.toHaveProperty('index');
      });
    });

    it('(GET) should get users keys if verified', async () => {
      const res = await endpoint.get('/2/keys', userAuthToken).expect(200);

      const actualUserKeys = await getUserKeys(2);

      expect(res.body).toHaveLength(actualUserKeys.length);
      res.body.forEach(key => {
        expect(key).toHaveProperty('mnemonicHash');
        expect(key).toHaveProperty('index');
      });
    });

    it('(GET) should not be able to get user keys if not verified', async () => {
      await endpoint.get('/2/keys', userNewAuthToken).expect(403);
    });

    it('(GET) should not be able to get user keys if not logged in', async () => {
      await endpoint.get('/2/keys').expect(401);
    });

    it('(POST) should upload your key if verified whatever user id is passed', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/123123123/keys', userAuthToken)
        .expect(201);

      const { publicKeyRaw: publicKeyRaw2 } = await generatePrivateKey();

      await endpoint.post({ publicKey: publicKeyRaw2 }, '/5134/keys', userAuthToken).expect(201);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys).toHaveLength(3); // 2 keys + 1 default key
    });

    it('(POST) should not be able to upload key if not verified', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userNewAuthToken)
        .expect(403);
    });

    it('(POST) should not be able to upload key if not logged in', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys').expect(401);
    });

    it('(POST) should not be able to upload key if invalid body', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({}, '/2/keys', userAuthToken).expect(400);

      await endpoint.post({ mnemonicHash }, '/2/keys', userAuthToken).expect(400);

      await endpoint.post({ index }, '/2/keys', userAuthToken).expect(400);

      await endpoint.post({ mnemonicHash, index }, '/2/keys', userAuthToken).expect(400);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw }, '/2/keys', userAuthToken)
        .expect(400);

      await endpoint.post({ publicKey: publicKeyRaw, index }, '/2/keys', userAuthToken).expect(400);
    });

    it('(POST) should not update index if uploading existing key and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthToken)
        .expect(201);

      const newIndex = 123;

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index: newIndex }, '/2/keys', userAuthToken)
        .expect(400);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].index).toEqual(index);
    });

    it('(POST) should update mnemonic if uploading existing key and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();
      const newMnemonic = '123';

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthToken)
        .expect(201);

      await endpoint
        .post(
          { mnemonicHash: newMnemonic, publicKey: publicKeyRaw, index },
          '/2/keys',
          userAuthToken,
        )
        .expect(201);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].mnemonicHash).toEqual(newMnemonic);
    });

    it('(POST) should set mnemonic if uploading existing key that has not set mnemonic and is users', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthToken).expect(201);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthToken)
        .expect(201);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys[actualUserKeys.length - 1].mnemonicHash).toEqual(mnemonicHash);
      expect(actualUserKeys[actualUserKeys.length - 1].index).toEqual(index);
    });

    it('(POST) should not be able to upload key already added key by other user', async () => {
      const { mnemonicHash, publicKeyRaw, index } = await generatePrivateKey();

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', userAuthToken)
        .expect(201);

      await endpoint
        .post({ mnemonicHash, publicKey: publicKeyRaw, index }, '/2/keys', adminAuthToken)
        .expect(400);
    });

    it.skip(
      '(POST) should not be able to upload key if user already has max keys',
      async () => {
        let userKeys = await getUserKeys(user.id);

        const keysToAdd = MAX_USER_KEYS - userKeys.length;

        const keysPromises = Array.from({ length: keysToAdd }, async () => generatePrivateKey());
        const keys = await Promise.all(keysPromises);

        for (const key of keys) {
          await endpoint
            .post({ publicKey: key.publicKeyRaw }, '/2/keys', userAuthToken)
            .expect(201);
        }

        const { publicKeyRaw } = await generatePrivateKey();

        await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthToken).expect(400);

        userKeys = await getUserKeys(user.id);

        for (const key of userKeys.slice(2, userKeys.length)) {
          await endpoint.delete(`/2/keys/${key.id}`, userAuthToken);
        }
      },
      900 * 1_000,
    );

    it('(POST) should recover key WITH mnemonic if key is deleted', async () => {
      const [{ id, publicKey, mnemonicHash, index }] = await getUserKeys(user.id);

      await endpoint.delete(`/2/keys/${id}`, userAuthToken).expect(200);

      const { status, body } = await endpoint.post(
        { mnemonicHash, publicKey: publicKey, index },
        '/2/keys',
        userAuthToken,
      );

      expect(status).toEqual(201);
      expect(body.mnemonicHash).toEqual(mnemonicHash);
    });

    it('(POST) should recover key WITHOUT mnemonic if key is deleted', async () => {
      const { publicKeyRaw } = await generatePrivateKey();
      let userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint
        .delete(`/2/keys/${userKeys[userKeys.length - 1].id}`, userAuthToken)
        .expect(200);

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthToken).expect(201);

      userKeys = await getUserKeys(user.id);
      await endpoint
        .delete(`/2/keys/${userKeys[userKeys.length - 1].id}`, userAuthToken)
        .expect(200);

      await endpoint.post({ publicKey: publicKeyRaw }, '/2/keys', userAuthToken).expect(201);
    });

    it("(DELETE) should delete user's key if verified", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userAuthToken).expect(200);

      const actualUserKeys = await getUserKeys(user.id);

      expect(actualUserKeys).toHaveLength(userKeys.length - 1);
    });

    it("(DELETE) should not delete user's key if not verified", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userNewAuthToken).expect(403);
    });

    it("(DELETE) should not delete user's key if not logged in", async () => {
      const userKeys = await getUserKeys(user.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`).expect(401);
    });

    it('(DELETE) should not delete user key if invalid id', async () => {
      await endpoint.delete(`/2/keys/123`, userAuthToken).expect(400);
    });

    it('(DELETE) should not delete another users key', async () => {
      const userKeys = await getUserKeys(admin.id);

      expect(userKeys).not.toHaveLength(0);

      await endpoint.delete(`/2/keys/${userKeys[0].id}`, userAuthToken).expect(400);
    });

    it('(PATCH) should update mnemonic hash', async () => {
      let userKeys = await getUserKeys(user.id);
      expect(userKeys).not.toHaveLength(0);

      const firstKeyId = userKeys[0].id;
      let key = userKeys.find(k => k.id === firstKeyId);
      const oldIndex = key.index;

      const newMnemonicHash = '0xabcd';

      const { body } = await endpoint
        .patch({ mnemonicHash: newMnemonicHash }, `/2/keys/${firstKeyId}`, userAuthToken)
        .expect(200);

      userKeys = await getUserKeys(user.id);
      key = userKeys.find(k => k.id === firstKeyId);

      expect(body.mnemonicHash).toEqual(newMnemonicHash);
      expect(body.index).toEqual(oldIndex);
      expect(key.mnemonicHash).toEqual(body.mnemonicHash);
      expect(key.index).toEqual(oldIndex);
    });

    it('(PATCH) should not update mnemonic hash if key not yours', async () => {
      const userKeys = await getUserKeys(admin.id);
      expect(userKeys).not.toHaveLength(0);

      const newMnemonicHash = '0xabcd';

      await endpoint
        .patch({ mnemonicHash: newMnemonicHash }, `/2/keys/${userKeys[0].id}`, userAuthToken)
        .expect(400);
    });

    it('(PATCH) should set index along with mnemonic hash', async () => {
      let userKeys = await getUserKeys(user.id);
      expect(userKeys).not.toHaveLength(0);

      const firstKeyId = userKeys[0].id;
      let key = userKeys.find(k => k.id === firstKeyId);

      const newMnemonicHash = '0xabcd';
      const newIndex = 123;

      const { body } = await endpoint
        .patch(
          { mnemonicHash: newMnemonicHash, index: newIndex },
          `/2/keys/${firstKeyId}`,
          userAuthToken,
        )
        .expect(200);

      userKeys = await getUserKeys(user.id);
      key = userKeys.find(k => k.id === firstKeyId);

      expect(body.mnemonicHash).toEqual(newMnemonicHash);
      expect(body.index).toEqual(newIndex);

      expect(key.mnemonicHash).toEqual(body.mnemonicHash);
      expect(key.index).toEqual(body.index);
    });
  });
});
