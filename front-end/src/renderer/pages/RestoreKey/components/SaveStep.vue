<script setup lang="ts">
import AppInput from '@renderer/components/ui/AppInput.vue';
import AppButton from '@renderer/components/ui/AppButton.vue';
import { ref } from 'vue';
import useUserStore from '@renderer/stores/storeUser';
import {
  assertUserLoggedIn,
  getErrorMessage,
  isLoggedInOrganization,
  safeAwait,
  safeDuplicateUploadKey,
} from '@renderer/utils';
import usePersonalPassword from '@renderer/composables/usePersonalPassword';
import { Prisma } from '@prisma/client';
import { useToast } from 'vue-toast-notification';
import useRecoveryPhraseNickname from '@renderer/composables/useRecoveryPhraseNickname';
import { useRouter } from 'vue-router';

const { restoredKey, mnemonicHashNickname, index } = defineProps<{
  restoredKey: { privateKey: string; publicKey: string; mnemonicHash: string } | null;
  mnemonicHashNickname: string;
  index: number;
}>();

/* Stores */
const user = useUserStore();

/* Composables */
const recoveryPhraseNickname = useRecoveryPhraseNickname();
const router = useRouter();
const toast = useToast();
const { getPassword, passwordModalOpened } = usePersonalPassword();

/* State */
const nickname = ref('');
const loadingText = ref<string | null>(null);

/* Handlerss */
const handleSaveKey = async () => {
  assertUserLoggedIn(user.personal);
  const personalPassword = getPassword(handleSaveKey, {
    subHeading: 'Enter your application password to decrypt your key',
  });
  if (passwordModalOpened(personalPassword)) return;

  if (!restoredKey) {
    throw new Error('Restored key not found');
  }

  try {
    loadingText.value = 'Saving key pair...';

    const keyPair: Prisma.KeyPairUncheckedCreateInput = {
      user_id: user.personal.id,
      index: Number(index),
      private_key: restoredKey.privateKey,
      public_key: restoredKey.publicKey,
      type: 'ED25519',
      organization_id: null,
      organization_user_id: null,
      secret_hash: restoredKey.mnemonicHash,
      nickname: nickname.value || null,
    };

    const keyStored = user.keyPairs.find(k => k.public_key === restoredKey.publicKey);
    if (isLoggedInOrganization(user.selectedOrganization)) {
      const keyUploaded = user.selectedOrganization.userKeys.some(
        k => k.publicKey === restoredKey.publicKey,
      );
      if (keyUploaded && keyStored) {
        throw new Error('Key pair already exists');
      }

      keyPair.organization_id = user.selectedOrganization.id;
      keyPair.organization_user_id = user.selectedOrganization.userId;

      await safeDuplicateUploadKey(user.selectedOrganization, {
        publicKey: restoredKey.publicKey,
        index: keyPair.index,
        mnemonicHash: restoredKey.mnemonicHash,
      });
    }

    if (!keyStored) {
      await user.storeKey(keyPair, restoredKey.mnemonicHash, personalPassword, false);
    }

    await safeAwait(recoveryPhraseNickname.set(restoredKey.mnemonicHash, mnemonicHashNickname));
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
</script>

<template>
  <form class="w-100" @submit.prevent="handleSaveKey" v-focus-first-input>
    <h1 class="text-display text-bold text-center">Enter Key Nickname</h1>
    <p class="text-main mt-5 text-center">
      You can optionally enter a nickname for the private key generated at {{ index }} to reference
      it more easily later.
    </p>
    <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
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
        >
          Continue
        </AppButton>
      </div>
    </div>
  </form>
</template>
