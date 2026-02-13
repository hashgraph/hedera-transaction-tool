<script setup lang="ts">
import type { KeyPair } from '@prisma/client';

import { onMounted, ref, watch } from 'vue';

import useUserStore from '@renderer/stores/storeUser';
import useAccountSetupStore from '@renderer/stores/storeAccountSetup';

import { useToast } from 'vue-toast-notification';
import { useRouter } from 'vue-router';
import useSetDynamicLayout, {
  ACCOUNT_SETUP_LAYOUT,
} from '@renderer/composables/useSetDynamicLayout';
import useRecoveryPhraseHashMigrate from '@renderer/composables/useRecoveryPhraseHashMigrate';

import { isLoggedInOrganization, safeAwait } from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import ResetDataModal from '@renderer/components/modals/ResetDataModal.vue';
import DeleteAllKeysRequiringHashMigrationModal from '@renderer/components/modals/DeleteAllKeysRequiringHashMigrationModal.vue';
import { updateIndex, updateMnemonicHash } from '@renderer/services/keyPairService.ts';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

/* Stores */
const user = useUserStore();
const accountSetupStore = useAccountSetupStore();

/* Composables */
useSetDynamicLayout(ACCOUNT_SETUP_LAYOUT);
const toast = useToast();
const router = useRouter();
const {
  getKeysToUpdateForRecoveryPhrase,
  updateKeyPairsHash,
  getRequiredKeysToMigrate,
  tryMigrateOrganizationKeys,
} = useRecoveryPhraseHashMigrate();

/* State */
const keysToUpdate = ref<KeyPair[]>([]);
const loadingText = ref<string | null>(null);
const isRecoveryPhraseValid = ref<boolean>(false);
const errorMessage = ref<string | null>(null);
const isResetDataModalShown = ref<boolean>(false);
const isDeleteAllModalShown = ref<boolean>(false);

/* Handlers */
const handleSkip = async () => {
  await user.setRecoveryPhrase(null);

  let keysToMigrate = await getRequiredKeysToMigrate();
  if (isLoggedInOrganization(user.selectedOrganization) && keysToMigrate.length > 0) {
    await safeAwait(tryMigrateOrganizationKeys(keysToMigrate));
    keysToMigrate = await getRequiredKeysToMigrate();
  }
  for (const key of keysToMigrate) {
    await updateMnemonicHash(key.id, null);
    await updateIndex(key.id, -1);
  }
  await user.refetchKeys();

  await router.push({ name: 'transactions' });
};

const handleVerify = async () => {
  if (!user.recoveryPhrase) {
    errorMessage.value = null;
    return;
  }

  keysToUpdate.value = [];
  loadingText.value = 'Verifying recovery phrase...';

  const { data, error } = await safeAwait(
    getKeysToUpdateForRecoveryPhrase(user.recoveryPhrase.words),
  );

  if (error) {
    errorMessage.value = error instanceof Error ? error.message : 'An unknown error occurred';
    isRecoveryPhraseValid.value = false;
  } else if (data && data.length > 0) {
    keysToUpdate.value = data;
    errorMessage.value = null;
    isRecoveryPhraseValid.value = true;
  } else {
    errorMessage.value = "Recovery phrase doesn't match your keys";
    isRecoveryPhraseValid.value = false;
  }

  loadingText.value = null;
};

const handleContinue = async () => {
  if (!user.recoveryPhrase) {
    return;
  }

  loadingText.value = 'Updating recovery phrase hash...';
  const { error } = await safeAwait(
    updateKeyPairsHash(keysToUpdate.value, user.recoveryPhrase.hash),
  );
  if (!error) {
    toast.success('Recovery phrase hash updated successfully', successToastOptions);
    await router.push({ name: 'transactions' });
  }
  loadingText.value = null;
};

const handleOpenResetModal = () => (isResetDataModalShown.value = true);
const handleDataReset = () => router.push({ name: 'login' });

const handleOpenDeleteAllKeysModal = () => (isDeleteAllModalShown.value = true);
const handleKeysDeleted = async () => {
  await user.refetchUserState();
  await user.refetchKeys();
  await user.refetchAccounts();

  if (await accountSetupStore.shouldShowAccountSetup()) {
    await router.push({ name: 'accountSetup' });
  }
};

/* Hooks */
onMounted(async () => {
  await user.setRecoveryPhrase(null);
});

/* Watchers */
watch(() => user.recoveryPhrase, handleVerify);
</script>
<template>
  <div class="flex-column-100 flex-centered">
    <div class="fill-remaining d-flex align-items-center p-6">
      <div class="container-dark-border bg-modal-surface glow-dark-bg p-5">
        <h4 class="text-title text-semi-bold text-center">Recovery Phrase</h4>
        <p class="text-main text-center mt-3">
          All previously created private keys need to be rematched to a mnemonic. This process is
          required before the application will be fully usable. Enter your recovery phrase to
          rematch your keys.
        </p>
        <div class="mt-4">
          <Import />
        </div>

        <div class="mt-5 ms-3">
          <p class="text-danger">
            {{ errorMessage }}
          </p>
        </div>

        <div class="flex-centered justify-content-between mt-5 ms-3">
          <div>
            <AppButton color="secondary" @click="handleSkip" data-testid="button-skip"
              >Skip</AppButton
            >
          </div>

          <div class="d-flex gap-3">
            <template v-if="user.selectedOrganization">
              <div>
                <AppButton
                  color="secondary"
                  @click="handleOpenDeleteAllKeysModal"
                  data-testid="button-open-delete-all-keys-modal"
                  >Delete All Keys</AppButton
                >
                <DeleteAllKeysRequiringHashMigrationModal
                  v-model:show="isDeleteAllModalShown"
                  @keys:deleted="handleKeysDeleted"
                />
              </div>
            </template>
            <template
              v-else-if="
                user.personal &&
                user.personal.isLoggedIn &&
                user.personal.useKeychain &&
                !user.selectedOrganization
              "
            >
              <div>
                <AppButton
                  color="secondary"
                  @click="handleOpenResetModal"
                  data-testid="button-open-reset-modal"
                  >Reset data</AppButton
                >
                <ResetDataModal
                  v-model:show="isResetDataModalShown"
                  @data:reset="handleDataReset"
                />
              </div>
            </template>

            <div>
              <AppButton
                color="primary"
                @click="handleContinue"
                data-testid="button-next"
                :disabled="Boolean(loadingText) || !user.recoveryPhrase || !isRecoveryPhraseValid"
                :loading="Boolean(loadingText)"
                :loading-text="loadingText || ''"
                >Continue</AppButton
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
