<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import useKeyPairsStore from '../../stores/storeKeyPairs';

import GenerateOrImport from './components/GenerateOrImport.vue';
import Generate from './components/Generate.vue';
import Import from './components/Import.vue';

import AppModal from '../../components/ui/AppModal.vue';
import AppButton from '../../components/ui/AppButton.vue';
import { Mnemonic } from '@hashgraph/sdk';

const router = useRouter();

const keyPairsStore = useKeyPairsStore();

const recoveryPhrase = ref<string[] | null>(null);

const step = ref(1);
const type = ref<'generate' | 'import' | ''>('');
const ableToContinue = ref(false);

const isSuccessModalShown = ref(false);
const modalText = ref('');

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
  modalText.value =
    type.value === 'generate'
      ? 'Recovery Phrase Created Successfully'
      : 'Recovery Phrase Imported Successfully';
  isSuccessModalShown.value = true;
};

const handleContinue = () => {
  router.push({ path: '/settings/keys' });
};
</script>
<template>
  <div class="recovery-phrase-page container-page p-8">
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <template v-if="step === 1">
        <GenerateOrImport
          v-model:step="step"
          v-model:recoveryPhrase="recoveryPhrase"
          v-model:type="type"
        />
      </template>
      <!-- Step 2 -->
      <template v-else-if="step === 2">
        <Generate
          v-if="type === 'generate'"
          v-model:recoveryPhrase="recoveryPhrase"
          :handleFinish="handleFinish"
        />
        <Import
          v-else-if="type === 'import'"
          v-model:recoveryPhrase="recoveryPhrase"
          :ableToContinue="ableToContinue"
          :handleFinish="handleFinish"
        />
      </template>
    </Transition>
    <AppModal v-model:show="isSuccessModalShown">
      <div class="p-5 container-modal-card">
        <i
          class="bi bi-x-lg d-inline-block cursor-pointer"
          style="line-height: 16px"
          @click="isSuccessModalShown = false"
        ></i>
        <div class="mt-5 text-center">
          <i
            class="bi bi-check-circle-fill extra-large-icon cursor-pointer"
            style="line-height: 16px"
            @click="isSuccessModalShown = false"
          ></i>
        </div>

        <h3 class="mt-5 text-main text-center text-bold">{{ modalText }}</h3>
        <!-- <p class="text-center text-small">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit.
        </p> -->
        <AppButton color="primary" size="large" class="mt-5 w-100 rounded-4" @click="handleContinue"
          >Continue</AppButton
        >
      </div>
    </AppModal>
  </div>
</template>
../../stores/storeKeyPairs
