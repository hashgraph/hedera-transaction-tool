<script setup lang="ts">
import { ref, watch } from 'vue';

import { useRouter } from 'vue-router';
import { useToast } from 'vue-toast-notification';
import useSetDynamicLayout, { LOGGED_IN_LAYOUT } from '@renderer/composables/useSetDynamicLayout';
import useMatchRecoveryPrase from '@renderer/composables/useMatchRecoveryPhrase';

import AppButton from '@renderer/components/ui/AppButton.vue';
import AppInput from '@renderer/components/ui/AppInput.vue';
import Import from '@renderer/components/RecoveryPhrase/Import.vue';
import { successToastOptions } from '@renderer/utils/toastOptions.ts';

const SEARCHING_TEXT = 'Abort Search';

/* Composables */
useSetDynamicLayout(LOGGED_IN_LAYOUT);
const toast = useToast();
const router = useRouter();
const { startMatching, externalKeys } = useMatchRecoveryPrase();

/* State */
const loadingText = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const startIndex = ref<number>(0);
const endIndex = ref<number>(100);
const abortController = ref<AbortController | null>(null);
const totalRecovered = ref<number>(0);
const cachedExternalKeys = ref([...externalKeys.value]);

const handleSearch = async () => {
  if (loadingText.value === SEARCHING_TEXT) {
    await handleAbort();
    return;
  }

  loadingText.value = SEARCHING_TEXT;
  try {
    abortController.value = new AbortController();

    const currentSearchCount = await startMatching(
      Number(startIndex.value),
      Number(endIndex.value),
      abortController.value,
      totalRecovered,
    );

    const message =
      currentSearchCount === 0
        ? 'No keys matched'
        : totalRecovered.value === cachedExternalKeys.value.length
          ? 'All keys matched to recovery phrase'
          : `Matched ${currentSearchCount} keys to recovery phrase`;
    toast.success(message, successToastOptions);
  } finally {
    loadingText.value = null;

    if (totalRecovered.value === cachedExternalKeys.value.length) {
      await router.back();
    }
  }
};

const handleAbort = async () => {
  loadingText.value = 'Aborting the search...';
  abortController.value?.abort();
  loadingText.value = null;
};

watch([startIndex, endIndex], async ([start, end]) => {
  if (Number(start) > Number(end)) {
    errorMessage.value = 'Start index must be less than end index';
  } else {
    errorMessage.value = null;
  }
});
</script>
<template>
  <div class="flex-column-100 p-7">
    <div class="position-relative">
      <AppButton color="secondary" @click="$router.back()">Back</AppButton>
    </div>
    <h4 class="text-display text-bold text-center">Match External Keys to Recovery Phrase</h4>
    <p class="text-center mt-1">
      Enter a recovery phrase to automatically match your external keys to it.
    </p>
    <div class="mt-8">
      <Import />
    </div>

    <hr class="separator my-4 mx-3" />

    <div class="d-flex flex-wrap align-items-center justify-content-between gap-4 ms-3">
      <div class="d-flex gap-3">
        <div class="form-group">
          <label class="form-label">Start Index</label>
          <AppInput
            v-model="startIndex"
            :filled="true"
            :disabled="Boolean(loadingText)"
            data-testid="input-start-index"
            type="number"
            placeholder="Enter start index"
          />
        </div>
        <div class="position-relative">
          <span class="absolute-centered" :style="{ top: '70%' }">-</span>
        </div>
        <div class="form-group">
          <label class="form-label">End Index</label>
          <AppInput
            v-model="endIndex"
            :filled="true"
            :disabled="Boolean(loadingText)"
            data-testid="input-end-index"
            type="number"
            placeholder="Enter end index"
          />
        </div>
      </div>
      <div class="form-group">
        <p class="form-label text-nowrap" :class="{ 'text-danger': errorMessage }">
          {{
            errorMessage
              ? errorMessage
              : `Total keys recovered: ${totalRecovered}/${cachedExternalKeys.length}`
          }}
        </p>
        <AppButton
          data-testid="button-search-abort"
          @click="handleSearch"
          :color="loadingText === SEARCHING_TEXT ? 'danger' : 'primary'"
          :disabled="externalKeys.length === 0 || isNaN(startIndex) || isNaN(endIndex)"
          :disable-on-loading="false"
          :loading="Boolean(loadingText)"
          :loading-text="loadingText || ''"
          >Search</AppButton
        >
      </div>
    </div>
  </div>
</template>
