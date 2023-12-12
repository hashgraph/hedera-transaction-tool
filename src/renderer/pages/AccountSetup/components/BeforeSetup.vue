<script setup lang="ts">
import AppButton from '../../../components/ui/AppButton.vue';
import AppRecoveryPhraseWord from '../../../components/ui/AppRecoveryPhraseWord.vue';

defineProps<{
  step: number;
}>();
const emit = defineEmits(['update:step']);

const exampleWords = [
  'gecko',
  'complete',
  'pan',
  'charming',
  'jazzman',
  'trumpet',
  'daylight',
  'booking',
  'doorstep',
  'seaside',
  'smiggle',
  'fever',
  'deadline',
  'money',
  'diopter',
  'reggae',
  'memory',
  'fresh',
  'rather',
  'stove',
  'among',
  'ten',
  'agree',
  'number',
];
</script>
<template>
  <div class="h-100 d-flex flex-column justify-content-center align-items-center">
    <h1 class="text-subheader text-bold text-center">Before you start setting up acoount</h1>
    <p class="text-main mt-5 text-center">
      The 24-word recovery phrase is a private key used to regain access to your Key Pair. Store it
      somewhere save and in the exact same order
    </p>
    <div class="mt-8 d-flex justify-content-center">
      <div class="col-12 col-lg-8 col-xxl-6">
        <div class="w-100 h-50 p-5 bg-body-secondary overflow-hidden">
          <div class="m-3 p-3 bg-body row g-3">
            <template v-for="(word, index) in exampleWords" :key="index">
              <AppRecoveryPhraseWord
                :word="word"
                :index="index + 1"
                readonly
                visible-initially
                class="col-3"
              ></AppRecoveryPhraseWord>
            </template>
          </div>
        </div>
        <div class="d-flex justify-content-center">
          <p class="w-75 mt-8 py-4 px-3 toast show border-0 rounded-3">
            Important: Never share your recovery phrase with anyone.
          </p>
        </div>
        <AppButton
          size="large"
          color="primary"
          class="mt-8 w-100 rounded-4"
          @click="emit('update:step', step + 1)"
          >Start Setup</AppButton
        >
      </div>
    </div>
  </div>
</template>
