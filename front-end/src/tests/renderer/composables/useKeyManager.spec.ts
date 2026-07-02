import { ref } from 'vue';
import type { KeyPair } from '@prisma/client';
import type { IUserKey } from '@shared/interfaces';
import useKeyManager, { KeyInfo } from '@renderer/composables/useKeyManager.ts';

describe('useKeyManager', () => {

  test('Check reactive merge of KeyPair and userKey', async () => {
    const keyPairs = ref<KeyPair[]>([]);
    const userKeys = ref<IUserKey[]>([]);
    const manager = useKeyManager(keyPairs, userKeys);
    expect(manager.keyInfos.value.length).toBe(0);

    // Adds a key pair
    const SAMPLE_KEY_PAIR: KeyPair = {
      id: '36703f32-fb06-44ef-972a-3e18b62be01e',
      user_id: '4f7e9ed9-f52e-4301-beff-0519a4c60c57',
      index: -1,
      public_key: 'a588d46597c0a3fb8c7c875387d2bdc96c44bee65fa1fef8c917a94de6396141',
      private_key: 'xxxxyyyyyzzzz',
      type: 'ECDSA',
      organization_id: '732d44e5-c867-4377-8a57-aa4694fc97bc',
      secret_hash: null,
      nickname: 'Nice key pair',
      organization_user_id: 1,
    };
    keyPairs.value = [SAMPLE_KEY_PAIR];
    expect(manager.keyInfos.value.length).toBe(1);
    expect(manager.keyInfos.value[0]).toEqual({
      publicKey: SAMPLE_KEY_PAIR.public_key,
      keyPair: SAMPLE_KEY_PAIR,
      userKey: null,
    });
    expect(manager.keyInfos.value[0].mnemonicHash()).toBe(null);
    expect(manager.keyInfos.value[0].index()).toBe(-1);

    // Adds matching user key
    const SAMPLE_USER_KEY: IUserKey = {
      id: 42,
      userId: 7,
      mnemonicHash: undefined,
      index: undefined,
      publicKey: SAMPLE_KEY_PAIR.public_key,
      deletedAt: undefined,
    };
    userKeys.value = [SAMPLE_USER_KEY];
    expect(manager.keyInfos.value.length).toBe(1);
    expect(manager.keyInfos.value[0]).toEqual({
      publicKey: SAMPLE_KEY_PAIR.public_key,
      keyPair: SAMPLE_KEY_PAIR,
      userKey: SAMPLE_USER_KEY,
    });
    expect(manager.keyInfos.value[0].mnemonicHash()).toBe(null);
    expect(manager.keyInfos.value[0].index()).toBe(-1);

    // Removes matching user key
    userKeys.value = [];
    expect(manager.keyInfos.value.length).toBe(1);
    expect(manager.keyInfos.value[0]).toEqual({
      publicKey: SAMPLE_KEY_PAIR.public_key,
      keyPair: SAMPLE_KEY_PAIR,
      userKey: null,
    });
    expect(manager.keyInfos.value[0].mnemonicHash()).toBe(null);
    expect(manager.keyInfos.value[0].index()).toBe(-1);

    // Adds matching user key with deletedAt set
    const DELETED_SAMPLE_USER_KEY = { ...SAMPLE_USER_KEY, deletedAt: '2026-07-01 07:02:03.815225' };
    userKeys.value = [DELETED_SAMPLE_USER_KEY];
    expect(manager.keyInfos.value.length).toBe(1);
    expect(manager.keyInfos.value[0]).toEqual({
      publicKey: SAMPLE_KEY_PAIR.public_key,
      keyPair: SAMPLE_KEY_PAIR,
      userKey: null,
    });
    expect(manager.keyInfos.value[0].mnemonicHash()).toBe(null);
    expect(manager.keyInfos.value[0].index()).toBe(-1);
  });


  test('KeyInfo.compare()', () => {

    const SAMPLE_KEY_PAIR: KeyPair = {
      id: '36703f32-fb06-44ef-972a-3e18b62be01e',
      user_id: '4f7e9ed9-f52e-4301-beff-0519a4c60c57',
      index: -1,
      public_key: 'a588d46597c0a3fb8c7c875387d2bdc96c44bee65fa1fef8c917a94de6396141',
      private_key: 'xxxxyyyyyzzzz',
      type: 'ECDSA',
      organization_id: '732d44e5-c867-4377-8a57-aa4694fc97bc',
      secret_hash: null,
      nickname: 'Nice key pair',
      organization_user_id: 1,
    };
    const SAMPLE_USER_KEY: IUserKey = {
      id: 42,
      userId: 7,
      mnemonicHash: undefined,
      index: undefined,
      publicKey: SAMPLE_KEY_PAIR.public_key,
      deletedAt: undefined,
    };

    const SAMPLE_KEY_INFO = new KeyInfo(
      SAMPLE_KEY_PAIR.public_key,
      SAMPLE_KEY_PAIR,
      SAMPLE_USER_KEY,
    );
    const TO_BE_RESTORED_KEY_INFO = new KeyInfo(SAMPLE_KEY_PAIR.public_key, null, SAMPLE_USER_KEY);
    const TO_BE_UPLOADED_KEY_INFO = new KeyInfo(SAMPLE_KEY_PAIR.public_key, SAMPLE_KEY_PAIR, null);

    const r1 = KeyInfo.compare(SAMPLE_KEY_INFO, SAMPLE_KEY_INFO);
    expect(r1).toBe(0);
    const r2 = KeyInfo.compare(SAMPLE_KEY_INFO, TO_BE_RESTORED_KEY_INFO);
    expect(r2).toBe(-1);
    const r3 = KeyInfo.compare(SAMPLE_KEY_INFO, TO_BE_RESTORED_KEY_INFO);
    expect(r3).toBe(-1);
    const r4 = KeyInfo.compare(TO_BE_RESTORED_KEY_INFO, TO_BE_UPLOADED_KEY_INFO);
    expect(r4).toBe(-1);

    // Patches SAMPLE_USER_KEY with null values (like what is really returned by server)
    // and redoes the same checks
    const PATCHED_SAMPLE_USER_KEY = { ...SAMPLE_USER_KEY, mnemonicHash: null, index: null };
    const PATCHED_TO_BE_RESTORED_KEY_INFO = new KeyInfo(
      SAMPLE_KEY_PAIR.public_key,
      null,
      PATCHED_SAMPLE_USER_KEY as unknown as IUserKey,
    );
    const r5 = KeyInfo.compare(SAMPLE_KEY_INFO, PATCHED_TO_BE_RESTORED_KEY_INFO);
    expect(r5).toBe(-1);
    const r6 = KeyInfo.compare(SAMPLE_KEY_INFO, PATCHED_TO_BE_RESTORED_KEY_INFO);
    expect(r6).toBe(-1);
    const r7 = KeyInfo.compare(PATCHED_TO_BE_RESTORED_KEY_INFO, TO_BE_UPLOADED_KEY_INFO);
    expect(r7).toBe(-1);
  })
});
