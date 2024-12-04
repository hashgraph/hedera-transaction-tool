<script setup lang="ts">
import type { USER_PASSWORD_MODAL_TYPE } from '@renderer/providers';

import { inject, onBeforeUnmount, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import {
  assertIsLoggedInOrganization,
  isUserLoggedIn,
  restoreOrganizationKeys,
} from '@renderer/utils';

import { USER_PASSWORD_MODAL_KEY } from '@renderer/providers';

import AppButton from '@renderer/components/ui/AppButton.vue';
import Import from '@renderer/pages/AccountSetup/components/Import.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* Injected */
const userPasswordModalRef = inject<USER_PASSWORD_MODAL_TYPE>(USER_PASSWORD_MODAL_KEY);

/* State */
const step = ref(0);

/* Handlers */
const handleImportRecoveryPhrase = async () => {
  assertIsLoggedInOrganization(user.selectedOrganization);
  const restoredKeys = await restoreOrganizationKeys(
    user.selectedOrganization,
    user.recoveryPhrase,
    user.personal,
    user.keyPairs,
    true,
  );

  for (const error of restoredKeys.failedRestoreMessages) {
    toast.error(error, { position: 'bottom-right' });
  }

  if (restoredKeys.keys.length === 0) {
    throw new Error('No keys to restore');
  }

  await storeKeys(restoredKeys.keys);
};

const handleClearWords = () => (user.recoveryPhrase = null);

const storeKeys = async (
  keys: {
    publicKey: string;
    privateKey: string;
    index: number;
    mnemonicHash: string;
  }[],
) => {
  if (!isUserLoggedIn(user.personal)) throw Error('User is not logged in');
  const personalPassword = user.getPassword();
  if (!personalPassword && !user.personal.useKeychain) {
    if (!userPasswordModalRef) throw new Error('User password modal ref is not provided');
    userPasswordModalRef.value?.open(
      'Enter your application password',
      'Enter your application password to decrypt your key',
      storeKeys.bind(this, keys),
    );
    return;
  }

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
          secret_hash: user.recoveryPhrase.hash,
          nickname: null,
        },
        user.recoveryPhrase.words,
        personalPassword,
        false,
      );
      restoredKeys++;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to store key pair', {
        position: 'bottom-right',
      });
    }
  }

  user.recoveryPhrase = null;
  await user.refetchUserState();

  if (restoredKeys > 0) {
    toast.success('Key Pairs restored', { position: 'bottom-right' });
  }
  router.push({ name: 'settingsKeys' });
};

/* Hooks */
onBeforeUnmount(() => {
  user.recoveryPhrase = null;
});
</script>
<template>
  <div class="flex-column-100 p-8">
    <div class="position-relative">
      <AppButton color="secondary" @click="$router.back()">Back</AppButton>
    </div>
    <div class="flex-centered flex-column-100">
      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <div v-if="step === 0" class="w-100">
          <h1 class="text-display text-bold text-center">
            Restore shared keys from Recovery Phrase
          </h1>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppButton
                size="large"
                data-testid="button-continue"
                color="primary"
                class="d-block w-100"
                @click="step++"
                >Continue</AppButton
              >
              <AppButton
                size="large"
                data-testid="button-cancel"
                color="secondary"
                class="mt-4 d-block w-100"
                @click="$router.back()"
                >Cancel</AppButton
              >
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <form
          v-else-if="step === 1"
          @submit.prevent="handleImportRecoveryPhrase"
          class="fill-remaining"
        >
          <h1 class="text-display text-bold text-center">Enter your Recovery Phrase</h1>
          <div class="mt-8">
            <Import />
            <div class="row justify-content-between mt-6">
              <div class="col-4 d-grid">
                <AppButton type="button" color="secondary" @click="handleClearWords"
                  >Clear</AppButton
                >
              </div>
              <div class="col-4 d-grid">
                <AppButton
                  color="primary"
                  data-testid="button-continue-phrase"
                  :disabled="!user.recoveryPhrase"
                  type="submit"
                  >Continue</AppButton
                >
              </div>
            </div>
          </div>
        </form>
      </Transition>
    </div>
  </div>
</template>
