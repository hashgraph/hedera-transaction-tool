<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Mnemonic } from '@hashgraph/sdk';

import AppButton from '../../../components/ui/AppButton.vue';
import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

defineProps<{
  recoveryPhrase: string[] | null;
  handleFinish: () => void;
}>();
const emit = defineEmits(['update:recoveryPhrase']);

const importedPhrase = ref('');
const ableToContinue = ref(false);

const wordsArray = computed(() =>
  importedPhrase.value
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24),
);

watch(wordsArray, async newWordsArray => {
  if (newWordsArray.length === 24) {
    try {
      await Mnemonic.fromWords(newWordsArray);
      emit('update:recoveryPhrase', newWordsArray);
      ableToContinue.value = true;
    } catch {
      ableToContinue.value = false;
    }
  } else {
    emit('update:recoveryPhrase', []);
    ableToContinue.value = false;
  }
});
</script>
<template>
  <div class="d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-display text-bold text-center">Import Recovery Phrase</h1>
    <p class="text-main mt-5 text-center">Enter your words comma separated ex. "bird, fly"</p>
    <div class="mt-5 w-100 row justify-content-center">
      <div class="col-12 col-lg-10 col-xxl-8">
        <textarea
          class="mt-5 form-control text-main"
          cols="5"
          rows="5"
          v-model="importedPhrase"
        ></textarea>
        <div class="mt-4 row g-4 justify-content-center">
          <template v-for="(word, index) in wordsArray" :key="index">
            <AppRecoveryPhraseWord class="col-3" :word="word" :visible-initially="true" />
          </template>
        </div>
      </div>
    </div>
    <div v-if="ableToContinue" class="mt-5 w-100 row justify-content-center">
      <div class="col-12 col-md-6 col-lg-4">
        <AppButton size="large" color="secondary" class="mt-4 w-100 rounded-4" @click="handleFinish"
          >Continue</AppButton
        >
      </div>
    </div>
  </div>
</template>
