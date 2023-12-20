<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Mnemonic } from '@hashgraph/sdk';

import useKeyPairsStore from '../../stores/storeKeyPairs';

import * as keyPairService from '../../services/keyPairService';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import Import from '../AccountSetup/components/Import.vue';
import { IKeyPair } from '../../../main/shared/interfaces/IKeyPair';

const router = useRouter();
const keyPairsStore = useKeyPairsStore();

const step = ref(0);

const password = ref('');
const recoveryPhrase = ref([]);
const index = ref(0);
const nickname = ref('');

const inputIndexInvalid = ref(false);

const restoredKey = ref<{ privateKey: string; publicKey: string } | null>(null);

const ableToContinue = ref(false);
const isSuccessModalShown = ref(false);

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

const handleFinish = (words: string[]) => {
  keyPairsStore.setRecoveryPhrase(words || []);
  step.value++;
};

const handleRestoreKey = async () => {
  const privateKey = await keyPairService.restorePrivateKey(
    keyPairsStore.recoveryPhraseWords,
    '',
    index.value,
    'ED25519',
  );

  if (keyPairsStore.keyPairs.some(kp => kp.publicKey === privateKey.publicKey.toStringRaw())) {
    inputIndexInvalid.value = true;
    return;
  }
  inputIndexInvalid.value = false;

  keyPairsStore.clearRecoveryPhrase();

  restoredKey.value = {
    privateKey: privateKey.toStringRaw(),
    publicKey: privateKey.publicKey.toStringRaw(),
  };

  step.value++;
};

const handleSaveKey = async () => {
  if (restoredKey.value) {
    const keyPair: IKeyPair = {
      index: index.value,
      privateKey: restoredKey.value.privateKey,
      publicKey: restoredKey.value.publicKey,
    };

    if (nickname.value) {
      keyPair.nickname = nickname.value;
    }

    await keyPairsStore.storeKeyPair(password.value, keyPair);
    isSuccessModalShown.value = true;
  }
};
</script>
<template>
  <div class="p-10 d-flex flex-column justify-content-center align-items-center">
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <div v-if="step === 0" class="w-100">
        <h1 class="text-display text-bold text-center">Restore Key Pair</h1>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <AppButton size="large" color="primary" class="d-block w-100 rounded-4" @click="step++"
              >Continue</AppButton
            >
            <AppButton
              size="large"
              color="secondary"
              class="mt-4 d-block w-100 rounded-4"
              @click="router.back()"
              >Cancel</AppButton
            >
          </div>
        </div>
      </div>

      <!-- Step 2 -->
      <div v-else-if="step === 1" class="w-100">
        <h1 class="text-display text-bold text-center">Enter password</h1>
        <p class="text-main mt-5 text-center">Please enter new password</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <input
              v-model="password"
              type="password"
              class="form-control rounded-4"
              placeholder="Enter password"
            />
            <AppButton
              size="large"
              color="primary"
              class="mt-5 d-block w-100 rounded-4"
              :disabled="password.length === 0"
              @click="
                () => (keyPairsStore.recoveryPhraseWords.length === 24 ? (step += 2) : step++)
              "
              >Continue</AppButton
            >
          </div>
        </div>
      </div>

      <!-- Step 3 -->
      <div v-else-if="step === 2">
        <h1 class="text-center">Enter your recovery phrase</h1>
        <div class="mt-8">
          <Import :handle-continue="handleFinish" />
        </div>
      </div>

      <!-- Step 4 -->
      <div v-else-if="step === 3" class="w-100">
        <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
        <p class="text-main mt-5 text-center">Please enter the index of the key</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <input
              v-model="index"
              type="number"
              class="form-control rounded-4"
              :class="{ 'is-invalid': inputIndexInvalid }"
              placeholder="Enter key index"
            />
            <div v-if="inputIndexInvalid" class="invalid-feedback">
              Key at index {{ index }} is already restored.
            </div>
            <AppButton
              size="large"
              color="primary"
              class="mt-5 d-block w-100 rounded-4"
              :disabled="index < 0"
              @click="handleRestoreKey"
              >Continue</AppButton
            >
          </div>
        </div>
      </div>

      <!-- Step 5 -->
      <div v-else-if="step === 4" class="w-100">
        <h1 class="text-display text-bold text-center">Enter nickname</h1>
        <p class="text-main mt-5 text-center">Please enter your nickname (optional)</p>
        <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
          <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
            <input
              v-model="nickname"
              type="text"
              class="form-control rounded-4"
              placeholder="Enter nickname"
            />
            <AppButton
              size="large"
              color="primary"
              class="mt-5 d-block w-100 rounded-4"
              @click="handleSaveKey"
              >Continue</AppButton
            >
          </div>
        </div>
      </div>
    </Transition>
    <AppModal v-model:show="isSuccessModalShown" class="common-modal">
      <div class="p-5">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i class="bi bi-plus extra-large-icon cursor-pointer" style="line-height: 16px"></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">Key Pair saved</h3>
        <!-- <AppButton
          color="primary"
          size="large"
          class="mt-5 w-100 rounded-4"
          @click="router.push({ name: 'settingsKeys' })"
          >Share</AppButton
        > -->
        <AppButton
          color="primary"
          size="large"
          class="mt-4 w-100 rounded-4"
          @click="router.push({ name: 'settingsKeys' })"
          >Close</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
