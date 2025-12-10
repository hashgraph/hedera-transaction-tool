<script setup lang="ts">
import { onBeforeMount, ref, watch, watchEffect } from 'vue';

import useUserStore from '@renderer/stores/storeUser';

import { validateMnemonic } from '@renderer/services/keyPairService';

import AppRecoveryPhraseWord from '@renderer/components/ui/AppRecoveryPhraseWord.vue';

/* Props */
const props = defineProps<{
  shouldClear?: boolean;
}>();

/* Emits */
const emit = defineEmits(['reset-cleared']);

/* Constants */
const WORD_COUNT = 24;
const getDefaultWords = () => Array(WORD_COUNT).fill('');

/* Stores */
const user = useUserStore();

/* State */
const words = ref<string[]>(getDefaultWords());
const isMnemonicValid = ref(false);
const inputRefs = ref<(InstanceType<typeof AppRecoveryPhraseWord> | null)[]>([]);

/* Handlers */
const handleWordChange = (newWord: string, index: number) => {
  words.value[index] = newWord.toLocaleLowerCase();
  words.value = [...words.value];
};

const handlePaste = async (index: number) => {
  const items = await navigator.clipboard.readText();

  const mnemonic = items
    .toLocaleLowerCase()
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, WORD_COUNT);

  const isValid = await validateMnemonic(mnemonic);
  if (isValid && Array.isArray(mnemonic)) {
    words.value = mnemonic;
  } else if (mnemonic.length === 1) {
    handleWordChange(mnemonic[0], index);
  }
};

const handleClearWords = () => {
  words.value = getDefaultWords();
};

const onKeyDownHandler = (e: KeyboardEvent) => {
  const inputs = inputRefs.value.map(ref => ref?.inputRef).filter(Boolean) as HTMLInputElement[];
  const currentIndex = inputs.findIndex(input => input === e.target);
  const moveCursorToEnd = (input: HTMLInputElement) => {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  };

  if (e.key === 'ArrowRight' && currentIndex < inputs.length - 1) {
    e.preventDefault();
    moveCursorToEnd(inputs[currentIndex + 1]);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    if (currentIndex > 0) {
      moveCursorToEnd(inputs[currentIndex - 1]);
    }
  } else if (e.key === 'ArrowDown' && currentIndex + 4 < inputs.length) {
    e.preventDefault();
    moveCursorToEnd(inputs[currentIndex + 4]);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (currentIndex - 4 >= 0) {
      moveCursorToEnd(inputs[currentIndex - 4]);
    }
  }
};

/* Hooks */
onBeforeMount(() => {
  if (user.recoveryPhrase) {
    words.value = user.recoveryPhrase.words;
  }
});

/* Watchers */
watch(words, async newWords => {
  const normalizedWords = newWords.map(w => w.toLocaleLowerCase());
  isMnemonicValid.value = await validateMnemonic(normalizedWords);

  if (isMnemonicValid.value) {
    await user.setRecoveryPhrase(normalizedWords);
  } else {
    user.recoveryPhrase = null;
  }
});

watchEffect(() => {
  if (props.shouldClear) {
    handleClearWords();
    emit('reset-cleared', false);
  }
});
</script>
<template>
  <div>
    <div class="row flex-wrap g-12px mx-0">
      <template v-for="(word, index) in words || []" :key="index">
        <AppRecoveryPhraseWord
          ref="inputRefs"
          class="col-3"
          :word="word"
          :index="index + 1"
          :handle-word-change="newWord => handleWordChange(newWord, index)"
          visible-initially
          @keydown="onKeyDownHandler"
          @paste.prevent="handlePaste(index)"
        />
      </template>
    </div>
  </div>
</template>
