<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { PrivateKey } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import useUserStore from '@renderer/stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';

import { restorePrivateKey } from '@renderer/services/keyPairService';

import {
  assertUserLoggedIn,
  getErrorMessage,
  getSecretHashFromLocalKeys,
  getSecretHashFromUploadedKeys,
  isLoggedInOrganization,
  safeAwait,
  safeDuplicateUploadKey,
} from '@renderer/utils';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import RecoveryPhraseNicknameInput from '@renderer/components/RecoveryPhrase/RecoveryPhraseNicknameInput.vue';

/* Stores */
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const { getPassword, passwordModalOpened } = usePersonalPassword();
const recoveryPhraseNickname = useRecoveryPhraseNickname();

/* State */
const step = ref(0);
const index = ref(0);
const inputIndexInvalid = ref(false);
const nickname = ref('');
const mnemonicHashNickname = ref('');
const restoredKey = ref<{ privateKey: string; publicKey: string; mnemonicHash: string } | null>(
  null,
);

const loadingText = ref<string | null>(null);

/* Handlers */
const handleImportRecoveryPhrase = () => step.value++;

const handleClearWords = () => (user.recoveryPhrase = null);

const handleRestoreKey = async () => {
  if (!user.recoveryPhrase) {
    throw new Error('Recovery phrase not found');
  }

  try {
    loadingText.value = 'Restoring key pair...';

    const privateKey = await restorePrivateKey(
      user.recoveryPhrase.words,
      '',
      Number(index.value),
      'ED25519',
    );

    if (keyExists(privateKey)) {
      return (inputIndexInvalid.value = true);
    }

    inputIndexInvalid.value = false;
    restoredKey.value = {
      privateKey: privateKey.toStringRaw(),
      publicKey: privateKey.publicKey.toStringRaw(),
      mnemonicHash: user.recoveryPhrase.hash,
    };

    if (isLoggedInOrganization(user.selectedOrganization)) {
      const alreadyUploadedHash = await getSecretHashFromUploadedKeys(
        user.recoveryPhrase,
        user.selectedOrganization.userKeys,
      );
      if (alreadyUploadedHash) {
        restoredKey.value.mnemonicHash = alreadyUploadedHash;
      }
    } else {
      const alreadyStoredHash = await getSecretHashFromLocalKeys(
        user.recoveryPhrase,
        user.keyPairs,
      );
      if (alreadyStoredHash) {
        restoredKey.value.mnemonicHash = alreadyStoredHash;
      }
    }

    step.value++;
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to restore private key'));
  } finally {
    loadingText.value = null;
  }
};

const handleSaveKey = async () => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleSaveKey, {
    subHeading: 'Enter your application password to decrypt your key',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (!restoredKey.value) {
    throw new Error('Restored key not found');
  }

  try {
    loadingText.value = 'Saving key pair...';

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.personal.id,
      index: Number(index.value),
      private_key: restoredKey.value.privateKey,
      public_key: restoredKey.value.publicKey,
      type: 'ED25519',
      organization_id: null,
      organization_user_id: null,
      secret_hash: restoredKey.value.mnemonicHash,
      nickname: nickname.value || null,
    };

    const keyStored = user.keyPairs.find(k => k.public_key === restoredKey.value?.publicKey);
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const keyUploaded = user.selectedOrganization.userKeys.some(
        k => k.publicKey === restoredKey.value?.publicKey,
      );
      if (keyUploaded && keyStored) {
        throw new Error('Key pair already exists');
      }

      keyPair.organization_id = user.selectedOrganization.id;
      keyPair.organization_user_id = user.selectedOrganization.userId;

      await safeDuplicateUploadKey(user.selectedOrganization, {
        publicKey: restoredKey.value.publicKey,
        index: keyPair.index,
        mnemonicHash: restoredKey.value.mnemonicHash,
      });
    }

    if (!keyStored) {
      await user.storeKey(keyPair, restoredKey.value.mnemonicHash, personalPassword, false);
    }

    await safeAwait(
      recoveryPhraseNickname.set(restoredKey.value.mnemonicHash, mnemonicHashNickname.value),
    );
    user.recoveryPhrase = null;
    await user.refetchUserState();

    toast.success('Key pair saved');
    router.push({ name: 'settingsKeys' });
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to store private key'));
  } finally {
    loadingText.value = null;
  }
};

const handleFindEmptyIndex = async () => {
  if (!user.recoveryPhrase) return;

  let exists = false;
  do {
    const privateKey = await restorePrivateKey(
      user.recoveryPhrase.words,
      '',
      Number(index.value),
      'ED25519',
    );

    if (keyExists(privateKey)) {
      index.value++;
      exists = true;
    } else {
      exists = false;
    }
  } while (exists);
};

/* Functions */
const keyExists = (privateKey: PrivateKey) => {
  return user.keyPairs.some(kp => kp.public_key === privateKey.publicKey.toStringRaw());
};

/* Hooks */
onBeforeUnmount(() => {
  user.recoveryPhrase = null;
});

/* Watchers */
watch(index, () => (inputIndexInvalid.value = false));

watch(step, async newStep => {
  if (newStep === 2) {
    await handleFindEmptyIndex();
  }
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
        <form v-if="step === 0" @submit.prevent="handleImportRecoveryPhrase" class="fill-remaining">
          <h1 class="text-display text-bold text-center">Enter your Recovery Phrase</h1>
          <div class="mt-8">
            <Import />

            <div class="form-group mt-4">
              <label class="form-label">Enter Recovery Phrase Nickname</label>
              <RecoveryPhraseNicknameInput
                v-model="mnemonicHashNickname"
                :mnemonic-hash="user.recoveryPhrase?.hash"
                :filled="true"
                data-testid="input-recovery-phrase-nickname"
              />
            </div>

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

        <!-- Step 2 -->
        <form
          v-else-if="step === 1"
          class="w-100"
          @submit.prevent="handleRestoreKey"
          v-focus-first-input
        >
          <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
          <p class="text-main mt-5 text-center">Enter the index of the private key you want to generate from the recovery phrase</p>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppInput
                v-model="index"
                :filled="true"
                data-testid="input-index"
                type="number"
                :class="{ 'is-invalid': inputIndexInvalid }"
                placeholder="Enter key index"
              />
              <div v-if="inputIndexInvalid" class="invalid-feedback">
                Key at index {{ index }} is already restored.
              </div>
              <AppButton
                type="submit"
                data-testid="button-continue-index"
                color="primary"
                class="mt-4 d-block w-100"
                :disabled="index < 0"
                :loading="Boolean(loadingText)"
                :loading-text="loadingText || ''"
                >Continue</AppButton
              >
            </div>
          </div>
        </form>

        <!-- Step 3 -->
        <form
          v-else-if="step === 2"
          class="w-100"
          @submit.prevent="handleSaveKey"
          v-focus-first-input
        >
          <h1 class="text-display text-bold text-center">Enter Key Nickname</h1>
          <p class="text-main mt-5 text-center">You can optionally enter a nickname for the private key generated at {{ index }} to reference it more easily later</p>
          <div
            class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4"
          >
            <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
              <AppInput
                v-model="nickname"
                :filled="true"
                data-testid="input-nickname"
                placeholder="Enter nickname"
              />
              <AppButton
                type="submit"
                data-testid="button-continue-nickname"
                color="primary"
                class="mt-4 d-block w-100"
                :loading="Boolean(loadingText)"
                :loading-text="loadingText || ''"
                >Continue</AppButton
              >
            </div>
          </div>
        </form>
      </Transition>
    </div>
  </div>
</template>
