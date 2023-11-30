<script setup lang="ts">
import { computed, ref, watch } from 'vue';

defineProps<{
  recoveryPhrase: string[] | null;
  ableToContinue: boolean;
  handleFinish: () => void;
}>();
const emit = defineEmits(['update:recoveryPhrase']);

const importedPhrase = ref('');
const wordsArray = computed(() =>
  importedPhrase.value
    .split(/[\s,]+|,\s*|\n/)
    .filter(w => w)
    .slice(0, 24),
);

watch(importedPhrase, async () => {
  if (wordsArray.value.length === 24) {
    try {
      emit('update:recoveryPhrase', wordsArray.value);
    } catch (error) {
      emit('update:recoveryPhrase', null);
    }
  } else {
    emit('update:recoveryPhrase', null);
  }
});
</script>
<template>
  <div class="position-relative">
    <h2 class="text-center">Import Recovery Phrase manually</h2>
    <p class="mt-3 text-muted text-center">Enter your words comma separated ex. "bird, fly"</p>
    <button
      v-if="ableToContinue"
      class="position-absolute top-0 end-0 btn btn-primary text-subheader"
      @click="handleFinish"
    >
      Finish
    </button>
    <textarea
      class="mt-7 form-control text-main"
      id=""
      cols="5"
      rows="5"
      v-model="importedPhrase"
    ></textarea>
    <div class="mt-6 d-flex align-items-center justify-content-around flex-wrap gap-4">
      <div
        v-for="(word, index) in wordsArray"
        :key="index"
        class="col-3 px-5 py-4 bg-info border-main-gradient text-center"
      >
        {{ word }}
      </div>
    </div>
  </div>
</template>
