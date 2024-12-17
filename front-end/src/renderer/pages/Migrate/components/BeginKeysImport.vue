<script setup lang="ts">
import type { Prisma } from '@prisma/client';
import type { IUserKey, IUserKeyWithMnemonic } from '@main/shared/interfaces';
import type { RecoveryPhrase } from '@renderer/types';

import { ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { getDataMigrationKeysPath } from '@renderer/services/migrateDataService';
import { searchEncryptedKeys } from '@renderer/services/encryptedKeys';
import { restorePrivateKey, storeKeyPair } from '@renderer/services/keyPairService';
import { getUserState } from '@renderer/services/organization';
import { compareHash } from '@renderer/services/electronUtilsService';

import {
  userKeyHasMnemonic,
  isLoggedInOrganization,
  isUserLoggedIn,
  safeAwait,
  safeDuplicateUploadKey,
} from '@renderer/utils';

import DecryptKeys from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeys.vue';

/* Props */
const props = defineProps<{
  recoveryPhrase: RecoveryPhrase;
  recoveryPhrasePassword: string;
  selectedKeys: IUserKey[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'keysImported', importedCount: number): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const decryptKeysRef = ref<InstanceType<typeof DecryptKeys> | null>(null);

/* Handlers */
const handleEnd = async (importedCount: number) => {
  await safeAwait(restoreExistingKeys());
  await safeAwait(user.refetchUserState());
  emit('keysImported', importedCount);
};

/* Functions */
const restoreOnEmpty = async (userKeysWithMnemonic: IUserKeyWithMnemonic[]) => {
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('(BUG) Organization user id not set');

  if (userKeysWithMnemonic.length === 0) {
    for (let i = 0; i < 99; i++) {
      const result = await safeAwait(restoreKeyPair(i, 'Default', true));
      if (!result.error) break;
    }
  }
};

const restoreExistingKeys = async () => {
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('(BUG) Organization user id not set');

  const keysToRestore =
    props.selectedKeys.length > 0
      ? props.selectedKeys
      : await getUserState(user.selectedOrganization.serverUrl).then(state => state.userKeys);
  const userKeysWithMnemonic = keysToRestore.filter(userKeyHasMnemonic);

  await restoreOnEmpty(userKeysWithMnemonic);

  for (let i = 0; i < userKeysWithMnemonic.length; i++) {
    const userKey = userKeysWithMnemonic[i];

    /**
     * Restore key if it has a mnemonic hash and is the same as imported
     * If keys from multiple mnemonic phrases are present, they will be deleted as the system supports only one mnemonic phrase
     */
    if (userKeyHasMnemonic(userKey)) {
      const { data: matchedHash } = await safeAwait(
        compareHash([...props.recoveryPhrase.words].toString(), userKey.mnemonicHash),
      );

      if (matchedHash) {
        const alreadyRestored = user.keyPairs.some(kp => kp.public_key === userKey.publicKey);
        if (!alreadyRestored) {
          await safeAwait(restoreKeyPair(userKey.index, `Restored Key ${i + 1}`, false));
        }
      }
    }
  }
};

const restoreKeyPair = async (index: number, nickname: string, upload: boolean) => {
  if (!props.recoveryPhrase) throw new Error('(BUG) Recovery phrase not set');
  if (!isUserLoggedIn(user.personal)) throw new Error('(BUG) Organization user id not set');
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('(BUG) Organization user id not set');

  const passphrase = '';
  const type = 'ED25519';
  const restoredPrivateKey = await restorePrivateKey(
    props.recoveryPhrase.words,
    passphrase,
    index,
    type,
  );

  const keyPair: Prisma.KeyPairUncheckedCreateInput = {
    user_id: user.personal.id,
    index,
    public_key: restoredPrivateKey.publicKey.toStringRaw(),
    private_key: restoredPrivateKey.toStringRaw(),
    type,
    organization_id: user.selectedOrganization.id,
    organization_user_id: user.selectedOrganization.userId,
    secret_hash: props.recoveryPhrase.hash,
    nickname,
  };

  if (upload) {
    await safeDuplicateUploadKey(user.selectedOrganization, {
      publicKey: keyPair.public_key,
      index: keyPair.index,
      mnemonicHash: keyPair.secret_hash || undefined,
    });
  }

  await storeKeyPair(keyPair, user.personal.useKeychain ? null : user.personal.password, false);
  await user.refetchKeys();
};

/* Watchers */
watch(decryptKeysRef, async () => {
  if (!decryptKeysRef.value) return;

  const keysPath = await getDataMigrationKeysPath();
  const encryptedKeyPaths = await searchEncryptedKeys([keysPath]);
  const selectedKeyPublicKeys = props.selectedKeys.map(key => key.publicKey);
  const filteredPaths = encryptedKeyPaths.filter(path =>
    selectedKeyPublicKeys.some(publicKey => path.includes(publicKey)),
  );

  await decryptKeysRef.value?.process(filteredPaths, props.recoveryPhrase.words);
});
</script>
<template>
  <div>
    <DecryptKeys ref="decryptKeysRef" :default-password="recoveryPhrasePassword" @end="handleEnd" />
  </div>
</template>
