<script setup lang="ts">
import { ref, watch } from 'vue';

import { validateMnemonic } from '@renderer/services/keyPairService';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppModal from '@renderer/components/ui/AppModal.vue';
import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  show: boolean;
  mnemonic: string[] | null;
}>();

/* Emits */
const emit = defineEmits<{
  (event: 'update:show', show: boolean): void;
  (event: 'update:mnemonic', mnemonic: string[] | null): void;
  (event: 'continue'): void;
}>();

/* State */
const words = ref<string[]>(Array(24).fill(''));
const isMnenmonicValid = ref(false);

/* Handlers */
const handleSubmit = (event: Event) => {
  event.preventDefault();
  emit('update:mnemonic', words.value);
  emit('continue');
};

const handleSkip = () => {
  emit('update:mnemonic', null);
  emit('continue');
};

const handleClose = (show: boolean) => {
  reset();
  emit('update:mnemonic', null);
  emit('update:show', show);
};

/* Handlers */
const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord.toLocaleLowerCase();
  words.value = [...words.value];
};

const handlePaste = async (e: Event, index: number) => {
  e.preventDefault();

  const items = await navigator.clipboard.readText();

  const mnenmonic = items
    .toLocaleLowerCase()
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24);

  const isValid = await validateMnemonic(mnenmonic);

  if (isValid && Array.isArray(mnenmonic)) {
    words.value = mnenmonic;
  } else if (mnenmonic.length === 1) {
    handleWordChange(mnenmonic[0], index);
  }
};

const handleClearWords = () => {
  words.value = Array(24).fill('');
};

/* Function */
function reset() {
  words.value = Array(24).fill('');
  isMnenmonicValid.value = false;
}

/* Watchers */
watch(words, async newWords => {
  isMnenmonicValid.value = await validateMnemonic(newWords.map(w => w.toLocaleLowerCase()));
});

watch(
  () => props.show,
  () => reset(),
);
</script>
<template>
  <AppModal
    :show="show"
    @update:show="handleClose"
    class="large-modal"
    :close-on-click-outside="false"
    :close-on-escape="false"
  >
    <div class="p-5">
      <i class="bi bi-x-lg cursor-pointer" @click="handleClose(false)"></i>
      <div class="text-center mt-4">
        <i class="bi bi-key large-icon" style="line-height: 16px"></i>
      </div>
      <form @submit="handleSubmit">
        <h3 class="text-center text-title text-bold mt-3">Import recovery phrase (Optional)</h3>

        <p class="text-center mt-4">
          The keys matching this recovery phrase will be stored with index and mnemonic hash.
        </p>

        <p class="text-center">You may skip this step and all keys will be marked as external</p>

        <div class="row flex-wrap g-12px mx-0 mt-4">
          <template v-for="(word, index) in words || []" :key="index">
            <AppRecoveryPhraseWord
              class="col-3"
              :word="word"
              :index="index + 1"
              :handle-word-change="newWord => handleWordChange(newWord, index)"
              visible-initially
              @paste="handlePaste($event, index)"
            />
          </template>
        </div>
        <hr class="separator my-5" />

        <div class="flex-between-centered gap-4 overflow-hidden">
          <AppButton color="borderless" type="button" class="min-w-unset" @click="handleClearWords"
            >Clear</AppButton
          >
          <div class="flex-between-centered gap-4">
            <AppButton color="secondary" type="button" @click="handleSkip">Skip</AppButton>
            <AppButton color="primary" type="submit" :disabled="!isMnenmonicValid"
              >Import</AppButton
            >
          </div>
        </div>
      </form>
    </div>
  </AppModal>
</template>
