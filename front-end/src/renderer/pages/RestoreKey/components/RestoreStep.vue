<script setup lang="ts">
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref, watch } from 'vue';
import useUserStore from '@renderer/stores/storeUser';
import { restorePrivateKey } from '@renderer/services/keyPairService';
import { PrivateKey } from '@hashgraph/sdk';
import {
  getErrorMessage,
  getSecretHashFromLocalKeys,
  getSecretHashFromUploadedKeys,
  isLoggedInOrganization,
} from '@renderer/utils';
import { useToast } from 'vue-toast-notification';

/* Stores */
const user = useUserStore();

/* Emits */
const emit = defineEmits(['next']);

/* Composables */
const toast = useToast();

/* State */
const index = ref(0);
const inputIndexInvalid = ref(false);
const loadingText = ref<string | null>(null);
const restoredKey = ref<{ privateKey: string; publicKey: string; mnemonicHash: string } | null>(
  null,
);

/* Handlers */
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
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to restore private key'));
  } finally {
    loadingText.value = null;
    emit('next', restoredKey.value, Number(index.value));
  }
};

/* Functions */
const keyExists = (privateKey: PrivateKey) => {
  return user.keyPairs.some(kp => kp.public_key === privateKey.publicKey.toStringRaw());
};

/* Watchers */
watch(index, () => (inputIndexInvalid.value = false));
</script>

<template>
  <form class="w-100" @submit.prevent="handleRestoreKey" v-focus-first-input>
    <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
    <p class="text-main mt-5 text-center">
      Enter the index of the private key you want to generate from the recovery phrase
    </p>
    <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
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
</template>
