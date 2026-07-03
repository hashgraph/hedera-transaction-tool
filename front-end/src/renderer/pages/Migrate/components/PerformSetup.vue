<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { IUserKeyWithMnemonic, KeyPathWithName } from '@shared/interfaces';
import type { RecoveryPhrase } from '@renderer/types';
import type { PersonalUser } from './SetupPersonal.vue';
import type { ModelValue } from './SetupOrganizationForm.vue';
import { addOrganization } from '@renderer/services/organizationsService.ts';
import { changePassword, getUserState, login } from '@renderer/services/organization';
import {
  isLoggedInOrganization,
  isUserLoggedIn,
  safeAwait,
  safeDuplicateUploadKey,
  toggleAuthTokenInSessionStorage,
  userKeyHasMnemonic,
} from '@renderer/utils';
import { addOrganizationCredentials } from '@renderer/services/organizationCredentials.ts';
import { getDataMigrationKeysPath } from '@renderer/services/migrateDataService.ts';
import { searchEncryptedKeys } from '@renderer/services/encryptedKeys.ts';
import DecryptKeys from '@renderer/components/KeyPair/ImportEncrypted/components/DecryptKeys.vue';
import { compareHash } from '@renderer/services/electronUtilsService.ts';
import useUserStore from '@renderer/stores/storeUser.ts';
import { restorePrivateKey, storeKeyPair } from '@renderer/services/keyPairService.ts';
import type { Prisma } from '@prisma/client';

/* Props */
const props = defineProps<{
  personalUser: PersonalUser;
  organizationSetup: ModelValue | null;
  recoveryPhrase: RecoveryPhrase | null;
  recoveryPhrasePassword: string | null;
  selectedKeys: KeyPathWithName[];
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'didPerformSetup', importedKeyCount: number, error: unknown): void;
}>();

/* Stores */
const user = useUserStore();

/* State */
const progressText = ref('Setup…');
const decryptKeysRef = ref<InstanceType<typeof DecryptKeys> | null>(null);
const eyePersistence = new Promise(resolve => setTimeout(resolve, 3000));

/* Handlers */
const didDecryptKeys = async (importedCount: number) => {
  await safeAwait(restoreExistingKeys());
  await safeAwait(user.refetchUserState());
  await concludeSetup(importedCount, null);
};

/* Functions */
const concludeSetup = async (importedKeyCount: number, error: unknown) => {
  await eyePersistence;
  emit('didPerformSetup', importedKeyCount, error);
};

const setupOrganization = async (setup: ModelValue) => {
  // 1) Add organization
  progressText.value = 'Adding Organization...';
  const { id: organizationId } = await addOrganization({
    nickname: setup.organizationNickname,
    serverUrl: setup.organizationURL,
    key: '',
  });

  // 2) Login to organization
  progressText.value = 'Logging in Organization...';
  const email = setup.organizationEmail ?? props.personalUser.email!;
  const { jwtToken } = await login(
    setup.organizationURL,
    email,
    setup.temporaryOrganizationPassword,
  );
  toggleAuthTokenInSessionStorage(setup.organizationURL, jwtToken, false);

  // 3) Set new password
  progressText.value = 'Setting New Password...';
  await changePassword(
    setup.organizationURL,
    setup.temporaryOrganizationPassword,
    setup.newOrganizationPassword,
  );

  // 4) Add Organization Credentials
  progressText.value = 'Storing encrypted credentials...';
  addOrganizationCredentials(
    email,
    setup.newOrganizationPassword,
    organizationId,
    props.personalUser.personalId,
    jwtToken,
    setup.newOrganizationPassword,
    true,
  );

  // 5) Initialize user store
  await user.refetchOrganizations();
  if (user.organizations[0]) {
    await user.selectOrganization(user.organizations[0]);
  }
};

const startKeyImport = async () => {
  if (props.selectedKeys && props.selectedKeys.length > 0) {
    const selectedKeyPaths = props.selectedKeys.map(key => key.filepath);
    await decryptKeysRef.value?.process(selectedKeyPaths, props.recoveryPhrase?.words);
  } else {
    const keysPath = await getDataMigrationKeysPath();
    const encryptedKeyPaths = await searchEncryptedKeys([keysPath]);
    await decryptKeysRef.value?.process(encryptedKeyPaths, props.recoveryPhrase?.words);
  }
};

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

const restoreExistingKeys = async () => {
  if (!user.selectedOrganization || !props.recoveryPhrase) return;
  if (!isLoggedInOrganization(user.selectedOrganization))
    throw new Error('(BUG) Organization user id not set');

  const { userKeys } = await getUserState(user.selectedOrganization.serverUrl);
  const userKeysWithMnemonic = userKeys.filter(userKeyHasMnemonic);

  await restoreOnEmpty(userKeysWithMnemonic);

  for (let i = 0; i < userKeysWithMnemonic.length; i++) {
    const userKey = userKeysWithMnemonic[i];

    /**
     * Restore the key if its mnemonic hash matches the currently imported recovery phrase.
     * Do not restore if the key is already present in `user.keyPairs`.
     * Multiple mnemonic phrases are supported; keys from other mnemonic phrases are not deleted.
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

/* Hooks */
onMounted(async () => {
  try {
    if (props.organizationSetup !== null) {
      await setupOrganization(props.organizationSetup);
    }
    if (props.selectedKeys.length > 0) {
      await startKeyImport(); // Will call concludeSetup()
    } else {
      await concludeSetup(0, null);
    }
  } catch (error) {
    await concludeSetup(0, error);
  }
});
</script>

<template>
  <span>{{ progressText }}</span>
  <div>
    <DecryptKeys
      ref="decryptKeysRef"
      :default-password="recoveryPhrasePassword ?? undefined"
      @end="didDecryptKeys"
    />
  </div>
</template>
