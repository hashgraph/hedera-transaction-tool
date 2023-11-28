<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  generatePhrase,
  downloadFileUnencrypted,
  encryptPassphrase,
} from '../services/recoveryPhraseService';
import { Mnemonic } from '@hashgraph/sdk';

const router = useRouter();

const step = ref(1);
const type = ref('');
const ableToContinue = ref(false);

const recoveryPhrase = ref<Mnemonic | null>();

const passPhrase = ref('');
const rePassPhrase = ref('');

const importedPhrase = ref('');
const wordsArray = computed(() =>
  importedPhrase.value
    .split(', ')
    .filter(w => w)
    .slice(0, 24),
);

watch(importedPhrase, async () => {
  if (wordsArray.value.length === 24) {
    try {
      recoveryPhrase.value = await Mnemonic.fromWords(wordsArray.value);
      ableToContinue.value = true;
    } catch (error) {
      ableToContinue.value = false;
    }
  } else {
    ableToContinue.value = false;
  }
});

watch(step, newStep => {
  if (newStep === 3) {
    ableToContinue.value = false;
  }
});

const handleGeneratePhrase = async () => {
  recoveryPhrase.value = await generatePhrase();
};

const handleDownloadRecoveryPhrase = async () => {
  downloadFileUnencrypted(recoveryPhrase.value?._mnemonic.words || []);
};

const handleEncryptPassphrase = async () => {
  try {
    await encryptPassphrase(recoveryPhrase.value?._mnemonic.words || []);

    router.push({ path: '/settings/keys' });
  } catch (error) {
    console.log(error);
  }
};

const isPassphraseStrong = () => {
  //To be further validated

  if (passPhrase.value && passPhrase.value === rePassPhrase.value) {
    return true;
  }

  return false;
};
</script>
<template>
  <div class="container-page p-10">
    <!-- Go back -->
    <div class="d-flex justify-content-between">
      <button
        class="btn btn-outline-primary py-0 px-2 mb-4 text-title"
        @click="step = step === 1 ? 1 : step - 1"
      >
        <i class="bi-arrow-left"></i>
      </button>
      <button
        v-if="ableToContinue"
        class="btn btn-outline-primary py-0 px-2 mb-4 text-title"
        @click="step++"
      >
        <i class="bi-arrow-right"></i>
      </button>
    </div>
    <Transition name="fade" mode="out-in">
      <!-- Step 1 -->
      <div v-if="step === 1" class="h-100">
        <h1 class="text-huge text-bold text-center">Recovery Phrase</h1>
        <div class="h-50 d-flex justify-content-center align-items-center flex-wrap">
          <button
            type="button"
            class="btn btn-lg text-title btn-outline-primary me-4"
            @click="
              handleGeneratePhrase();
              type = 'generate';
              ableToContinue = true;
              step = 2;
            "
          >
            Generate Recovery Phrase
          </button>
          <button
            type="button"
            class="btn btn-lg text-title btn-outline-secondary"
            @click="
              type = 'import';
              recoveryPhrase = null;
              step = 2;
            "
          >
            Import Existing Phrase
          </button>
        </div>
      </div>
      <!-- Step 2 -->
      <div v-else-if="step === 2">
        <div v-if="type === 'generate'">
          <div class="d-flex justify-content-between">
            <button type="button" class="btn btn-outline-primary" @click="handleGeneratePhrase">
              Regenerate Recovery Phrase
            </button>
            <button type="button" class="btn btn-secondary" @click="handleDownloadRecoveryPhrase">
              Download file
            </button>
          </div>
          <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
            <div
              v-for="(word, index) in recoveryPhrase?._mnemonic.words || []"
              :key="index"
              class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
            >
              {{ word }}
            </div>
          </div>
        </div>
        <div v-if="type === 'import'">
          <h2 class="text-center">Import Recovery Phrase manually</h2>
          <p class="mt-3 text-muted text-center">
            Enter your words comma separated ex. "bird, fly"
          </p>
          <textarea
            class="mt-7 form-control text-main"
            id=""
            cols="5"
            rows="5"
            v-model="importedPhrase"
          ></textarea>
          <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
            <div
              v-for="(word, index) in importedPhrase
                .split(', ')
                .filter(w => w)
                .slice(0, 24) || []"
              :key="index"
              class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
            >
              {{ word }}
            </div>
          </div>
        </div>
      </div>
      <!-- Step 3 -->
      <div v-else-if="step === 3">
        <h2 class="text-center">Recover phrase requires a passphrase</h2>
        <p class="mt-5 mx-7 text-center text-muted">
          This password cannot be recovered or reset if forgotten.
        </p>
        <div class="w-50 mt-6 mx-auto d-flex flex-column gap-4">
          <div>
            <label>Passphrase</label>
            <input type="password" class="form-control py-3" v-model="passPhrase" />
          </div>
          <div>
            <label>Confirm passphrase</label>
            <input type="password" class="form-control py-3" v-model="rePassPhrase" />
          </div>
        </div>
        <div class="mt-8 text-center">
          <button
            class="btn btn-primary text-subheader"
            :disabled="!isPassphraseStrong()"
            @click="handleEncryptPassphrase"
          >
            Finish
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
