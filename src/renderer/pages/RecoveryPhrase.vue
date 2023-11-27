<script setup lang="ts">
import { ref } from 'vue';
import { generatePhrase } from '../services/recoveryPhraseService';
import { Mnemonic } from '@hashgraph/sdk';

const step = ref(1);
const recoveryPhrase = ref<Mnemonic | null>();

const handleGeneratePhrase = async () => {
  recoveryPhrase.value = await generatePhrase();
};

const handleDownloadPhrase = async () => {
  console.log('download');
};
</script>
<template>
  <div class="container-page p-10">
    <!-- Go back -->
    <button
      class="btn btn-outline-primary py-0 px-2 mb-4 text-title"
      @click="step = step === 1 ? 1 : step - 1"
    >
      <i class="bi-arrow-left"></i>
    </button>
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
              step++;
            "
          >
            Generate Recovery Phrase
          </button>
          <button type="button" class="btn btn-lg text-title btn-outline-secondary">
            Import Existing Phrase
          </button>
        </div>
      </div>
      <!-- Step 2 -->
      <div v-else-if="step === 2">
        <div class="d-flex justify-content-between">
          <button type="button" class="btn btn-outline-primary" @click="handleGeneratePhrase">
            Regenerate Recovery Phrase
          </button>
          <button type="button" class="btn btn-secondary" @click="handleDownloadPhrase">
            Download file
          </button>
        </div>
        <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
          <div
            v-for="word in recoveryPhrase?._mnemonic.words"
            :key="word"
            class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
          >
            {{ word }}
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
