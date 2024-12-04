<script setup lang="ts">
import { onMounted, ref } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';

import {
  assertIsLoggedInOrganization,
  assertUserLoggedIn,
  getErrorMessage,
  restoreOrganizationKeys,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import Import from '@renderer/pages/AccountSetup/components/Import.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const step = ref(0);
const loadingText = ref<string | null>(null);

/* Handlers */
const handleImportRecoveryPhrase = async () => {
  try {
    loadingText.value = 'Restoring keys...';
    assertIsLoggedInOrganization(user.selectedOrganization);
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

const handleClearWords = () => (user.recoveryPhrase = null);

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
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to store key pair'));
    }
  }

  user.recoveryPhrase = null;
  await user.refetchUserState();

  if (restoredKeys > 0) {
    toast.success('Key Pairs restored');
  }
  router.push({ name: 'settingsKeys' });
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
      <Transition name="fade" mode="out-in">
        <!-- Step 1 -->
        <div v-if="step === 0" class="w-100">
          <h1 class="text-display text-bold text-center">
            Restore missing keys from Recovery Phrase
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
                  :loading="Boolean(loadingText)"
                  :loading-text="loadingText || ''"
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
