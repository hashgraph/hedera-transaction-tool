<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';
import { KeyPair } from '@prisma/client';

import useKeyPairsStore from '../../stores/storeKeyPairs';
import useUserStore from '../../stores/storeUser';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';

import { comparePasswords } from '../../services/userService';
import * as keyPairService from '../../services/keyPairService';

import AppButton from '../../components/ui/AppButton.vue';
import AppInput from '../../components/ui/AppInput.vue';
import Import from '../AccountSetup/components/Import.vue';

/* Stores */
const keyPairsStore = useKeyPairsStore();
const user = useUserStore();

/* Composables */
const toast = useToast();
const router = useRouter();

/* State */
const step = ref(0);
const ableToContinue = ref(false);

const password = ref('');
const recoveryPhrase = ref([]);
const index = ref(0);
const nickname = ref('');

const inputIndexInvalid = ref(false);

const restoredKey = ref<{ privateKey: string; publicKey: string } | null>(null);

/* Watchers */
watch(recoveryPhrase, async newRecoveryPhrase => {
  if (!newRecoveryPhrase) {
    ableToContinue.value = false;
  } else if (newRecoveryPhrase.length === 24) {
    try {
      await Mnemonic.fromWords(recoveryPhrase.value || []);
      ableToContinue.value = true;
    } catch {
      ableToContinue.value = false;
    }
  }
});

watch(index, () => {
  inputIndexInvalid.value = false;
});

const handleFinish = e => {
  e.preventDefault();
  step.value++;
};

const handleEnterPassword = async e => {
  e.preventDefault();

  if (!(await comparePasswords(user.data.id, password.value))) {
    throw new Error('Incorrect password');
  }

  keyPairsStore.recoveryPhraseWords.length === 24 ? (step.value += 2) : step.value++;
};

const handleRestoreKey = async e => {
  e.preventDefault();

  try {
    const privateKey = await keyPairService.restorePrivateKey(
      keyPairsStore.recoveryPhraseWords,
      '',
      Number(index.value),
      'ED25519',
    );

    if (
      keyPairsStore.keyPairs.some(
        kp => kp.public_key === privateKey.publicKey.toStringRaw() && kp.public_key !== '',
      )
    ) {
      inputIndexInvalid.value = true;
      return;
    }
    inputIndexInvalid.value = false;

    restoredKey.value = {
      privateKey: privateKey.toStringRaw(),
      publicKey: privateKey.publicKey.toStringRaw(),
    };

    step.value++;
  } catch (err: any) {
    let message = 'Failed to restore privatek key';
    if (err.message && typeof err.message === 'string') {
      message = err.message;
    }
    toast.error(message, { position: 'bottom-right' });
  }
};

const handleSaveKey = async e => {
  e.preventDefault();

  if (restoredKey.value) {
    try {
      const secretHash = await keyPairService.hashRecoveryPhrase(keyPairsStore.recoveryPhraseWords);
      const keyPair: KeyPair = {
        id: '',
        user_id: user.data.id,
        index: Number(index.value),
        private_key: restoredKey.value.privateKey,
        public_key: restoredKey.value.publicKey,
        organization_id: null,
        secret_hash: secretHash,
        nickname: nickname.value || null,
      };
      await keyPairsStore.storeKeyPair(keyPair, password.value);

      keyPairsStore.clearRecoveryPhrase();

      toast.success('Key Pair saved', { position: 'bottom-right' });
      router.push({ name: 'settingsKeys' });
    } catch (err: any) {
      let message = 'Failed to store key pair';
      if (err.message && typeof err.message === 'string') {
        message = err.message;
      }
      toast.error(message, { position: 'bottom-right' });
    }
  }
};

onUnmounted(() => {
  keyPairsStore.clearRecoveryPhrase();
});
</script>
<template>
  <div class="p-10 d-flex flex-column justify-content-center align-items-center">
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <div v-if="step === 0" class="w-100">
        <h1 class="text-display text-bold text-center">Restore Key Pair</h1>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <AppButton size="large" color="primary" class="d-block w-100" @click="step++"
              >Continue</AppButton
            >
            <AppButton
              size="large"
              color="secondary"
              class="mt-4 d-block w-100"
              @click="$router.back()"
              >Cancel</AppButton
            >
          </div>
        </div>
      </div>

      <!-- Step 2 -->
      <form v-else-if="step === 1" class="w-100" @submit="handleEnterPassword">
        <h1 class="text-display text-bold text-center">Enter password</h1>
        <p class="text-main mt-5 text-center">Please enter new password</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <AppInput
              v-model="password"
              :filled="true"
              type="password"
              placeholder="Enter password"
            />
            <AppButton
              size="large"
              type="submit"
              color="primary"
              class="mt-5 d-block w-100"
              :disabled="password.length === 0"
              >Continue</AppButton
            >
          </div>
        </div>
      </form>

      <!-- Step 3 -->
      <form v-else-if="step === 2" @submit="handleFinish">
        <h1 class="text-center">Enter your recovery phrase</h1>
        <div class="mt-8">
          <Import :handle-continue="handleFinish" :secret-hashes="user.data.secretHashes" />
          <AppButton
            size="large"
            type="submit"
            color="primary"
            class="mt-5 mx-auto col-6 col-xxl-4 d-block"
            :disabled="keyPairsStore.recoveryPhraseWords.length === 0"
            >Continue</AppButton
          >
        </div>
      </form>

      <!-- Step 4 -->
      <form v-else-if="step === 3" class="w-100" @submit="handleRestoreKey">
        <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
        <p class="text-main mt-5 text-center">Please enter the index of the key</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <AppInput
              v-model="index"
              :filled="true"
              type="number"
              :class="{ 'is-invalid': inputIndexInvalid }"
              placeholder="Enter key index"
            />
            <div v-if="inputIndexInvalid" class="invalid-feedback">
              Key at index {{ index }} is already restored.
            </div>
            <AppButton
              size="large"
              type="submit"
              color="primary"
              class="mt-5 d-block w-100"
              :disabled="index < 0"
              >Continue</AppButton
            >
          </div>
        </div>
      </form>

      <!-- Step 5 -->
      <form v-else-if="step === 4" class="w-100" @submit="handleSaveKey">
        <h1 class="text-display text-bold text-center">Enter nickname</h1>
        <p class="text-main mt-5 text-center">Please enter your nickname (optional)</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <AppInput v-model="nickname" :filled="true" placeholder="Enter nickname" />
            <AppButton size="large" type="submit" color="primary" class="mt-5 d-block w-100"
              >Continue</AppButton
            >
          </div>
        </div>
      </form>
    </Transition>
  </div>
</template>
