<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import { restorePrivateKey } from '@renderer/services/keyPairService';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  getPublicKeyAndType,
  restoreOrganizationKeys,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Props */
const props = defineProps<{
  index?: string;
  publicKey?: string;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const loadingText = ref<string | null>(null);
const shouldClearInputs = ref(false);

/* Handlers */
const handleImportRecoveryPhrase = async () => {
  try {
    loadingText.value = 'Restoring keys...';
    assertIsLoggedInOrganization(user.selectedOrganization);

    const index = props.index;
    const publicKey = props.publicKey;

    if (index !== undefined && publicKey && user.recoveryPhrase) {
      const { keyType } = getPublicKeyAndType(publicKey);
      const derivedKey = await restorePrivateKey(
        user.recoveryPhrase.words,
        '',
        Number(index),
        keyType,
      );

      if (derivedKey.publicKey.toStringRaw() !== publicKey) {
        throw new Error('The Recovery Phrase does not match the Public Key');
      }
    }

    const restoredKeys = await restoreOrganizationKeys(
      user.selectedOrganization,
      user.recoveryPhrase,
      user.personal,
      user.keyPairs,
      true,
    );

    for (const error of restoredKeys.failedRestoreMessages) {
      toast.error(error);
    }

    if (restoredKeys.keys.length === 0) {
      throw new Error('No keys to restore');
    }

    loadingText.value = 'Storing keys...';
    await storeKeys(restoredKeys.keys);
  } finally {
    loadingText.value = null;
  }
};

const handleClearWords = (value: boolean) => {
  shouldClearInputs.value = value;
  user.setRecoveryPhrase(null);
};

const storeKeys = async (
  keys: {
    publicKey: string;
    privateKey: string;
    index: number;
    mnemonicHash: string;
  }[],
) => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(storeKeys.bind(this, keys), {
    subHeading: 'Enter your application password to decrypt your key',
  });
  if (passwordModalOpened(personalPassword)) return;

  let restoredKeys = 0;
  for (const key of keys) {
    assertIsLoggedInOrganization(user.selectedOrganization);
    if (!user.recoveryPhrase) {
      throw new Error('Recovery phrase is not set');
    }

    try {
      await user.storeKey(
        {
          user_id: user.personal.id,
          index: key.index,
          private_key: key.privateKey,
          public_key: key.publicKey,
          type: 'ED25519',
          organization_id: user.selectedOrganization.id,
          organization_user_id: user.selectedOrganization.userId,
          secret_hash: key.mnemonicHash,
          nickname: null,
        },
        key.mnemonicHash,
        personalPassword,
        false,
      );
      restoredKeys++;
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to store key pair'));
    }
  }

  user.recoveryPhrase = null;
  await user.refetchUserState();

  if (restoredKeys > 0) {
    toast.success('Key Pairs restored', successToastOptions);
  }
  await router.push({ name: 'settingsKeys' });
};

/* Hooks */
onMounted(() => {
  user.recoveryPhrase = null;
});
</script>
<template>
  <div class="flex-column-100 p-8">
    <div class="position-relative">
      <AppButton color="secondary" @click="$router.back()">Back</AppButton>
    </div>
    <div class="flex-centered flex-column-100">
      <form @submit.prevent="handleImportRecoveryPhrase" class="fill-remaining">
        <h1 class="text-display text-bold text-center">Enter your Recovery Phrase</h1>
        <div class="mt-8">
          <Import :should-clear="shouldClearInputs" @reset-cleared="handleClearWords($event)" />
          <div class="d-flex justify-content-between mt-4 mx-3">
            <div class="">
              <AppButton type="button" color="secondary" @click="handleClearWords(true)"
                >Clear</AppButton
              >
            </div>
            <div class="">
              <AppButton
                color="primary"
                data-testid="button-continue-phrase"
                :disabled="!user.recoveryPhrase"
                :loading="Boolean(loadingText)"
                :loading-text="loadingText || ''"
                type="submit"
                >Continue</AppButton
              >
            </div>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>
