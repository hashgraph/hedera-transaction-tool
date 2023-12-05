<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Mnemonic } from '@hashgraph/sdk';

import useKeyPairsStore from '../../stores/storeKeyPairs';

import AppButton from '../../components/ui/AppButton.vue';
import AppModal from '../../components/ui/AppModal.vue';
import Import from '../RecoveryPhrase/components/Import.vue';

const router = useRouter();
const keyPairsStore = useKeyPairsStore();

const step = ref(0);

const password = ref('');
const recoveryPhrase = ref([]);
const index = ref(0);
const nickname = ref('');

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

const handleFinish = () => {
  keyPairsStore.setRecoveryPhrase(recoveryPhrase.value || []);
  step.value++;
};

const handleCreateKey = async () => {
  await keyPairsStore.generatePrivateKey('', index.value);

  isSuccessModalShown.value = true;

  await keyPairsStore.setRecoveryPhrase([]);
};
</script>
<template>
  <Transition name="fade" mode="out-in">
    <div
      v-if="step === 0"
      class="p-10 d-flex flex-column justify-content-center align-items-center"
    >
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
    <div
      v-else-if="step === 1"
      class="p-10 d-flex flex-column justify-content-center align-items-center"
    >
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
            @click="() => (keyPairsStore.recoveryPhraseWords.length === 24 ? (step += 2) : step++)"
            >Continue</AppButton
          >
        </div>
      </div>
    </div>
    <Import
      v-else-if="step === 2"
      v-model:recovery-phrase="recoveryPhrase"
      :able-to-continue="ableToContinue"
      :handle-finish="handleFinish"
    />
    <div
      v-else-if="step === 3"
      class="p-10 d-flex flex-column justify-content-center align-items-center"
    >
      <h1 class="text-display text-bold text-center">Provide Index of Key</h1>
      <p class="text-main mt-5 text-center">Please enter the index of the key</p>
      <div class="mt-5 w-100 d-flex flex-column justify-content-center align-items-center gap-4">
        <div class="col-12 col-md-8 col-lg-6 col-xxl-4">
          <input
            v-model="index"
            type="number"
            class="form-control rounded-4"
            placeholder="Enter key index"
          />
          <AppButton
            size="large"
            color="primary"
            class="mt-5 d-block w-100 rounded-4"
            :disabled="index < 0"
            @click="step++"
            >Continue</AppButton
          >
        </div>
      </div>
    </div>
    <div
      v-else-if="step === 4"
      class="p-10 d-flex flex-column justify-content-center align-items-center"
    >
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
            @click="handleCreateKey"
            >Continue</AppButton
          >
        </div>
      </div>
      <AppModal v-model:show="isSuccessModalShown" class="common-modal">
        <div class="p-5 container-modal-card">
          <i
            class="bi bi-x-lg d-inline-block cursor-pointer"
            style="line-height: 16px"
            @click="isSuccessModalShown = false"
          ></i>
          <div class="mt-5 text-center">
            <i class="bi bi-plus extra-large-icon cursor-pointer" style="line-height: 16px"></i>
          </div>

          <h3 class="mt-5 text-main text-center text-bold">Key Pair saved</h3>
          <p class="text-center text-small">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
          <AppButton
            color="primary"
            size="large"
            class="mt-5 w-100 rounded-4"
            @click="router.push({ name: 'settingsKeys' })"
            >Share</AppButton
          >
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
  </Transition>
</template>
